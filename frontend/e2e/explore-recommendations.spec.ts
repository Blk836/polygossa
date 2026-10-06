import { expect, test, type Page, type Route } from "@playwright/test";

// Explore's personalised shelves (docs/acceptance/explore-recommendations.feature). One test runs against the real API
// for test@lector.local (needs public content by others, e.g. the seeded starter library) and undoes what it marks;
// the rest serve fixed shelves built from real cards, so every shelf, reason and action is shown, AI or not.

type Json = Record<string, unknown>;

/** A few real public cards (so links open real texts), signing in first. */
async function realCards(page: Page, count: number): Promise<Json[]> {
  await page.goto("/library");
  const res = await page.request.get(`/api/library?size=${count}`);
  const items = (await res.json()).items as Json[];
  expect(items.length, "the dev database needs some public content").toBeGreaterThanOrEqual(count);
  return items;
}

function fixture(cards: Json[]): Json {
  const [a, b, c, d] = cards;
  return {
    shelves: [
      { id: "continue", items: [{ text: a, reason: { kind: "progress", percent: 42 } }] },
      {
        id: "for-you",
        items: [
          { text: b, reason: { kind: "known", percent: 96 } },
          { text: c, reason: { kind: "explore" } },
        ],
      },
      { id: "because", anchor: { id: 1, title: "Tapas en Madrid", liked: true }, items: [{ text: d, reason: { kind: "because", title: "Tapas en Madrid", liked: true } }] },
      { id: "topic", topic: "cooking", items: [{ text: c, reason: { kind: "topic", topic: "cooking" } }] },
      { id: "just-right", items: [{ text: b, reason: { kind: "known", percent: 96 } }] },
      { id: "stretch", items: [{ text: d, reason: { kind: "known", percent: 88 } }] },
    ],
  };
}

/** Serves these shelves for every recommendations request, and records logged events instead of saving them. */
async function serve(page: Page, body: Json) {
  const events: Json[] = [];
  await page.route("**/api/recommendations?**", (route: Route) => route.fulfill({ json: body }));
  await page.route(/\/api\/recommendations$/, (route: Route) => route.fulfill({ json: body }));
  await page.route("**/api/recommendations/events", (route: Route) => {
    events.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  return events;
}

const shelf = (page: Page, name: string | RegExp) => page.getByRole("region", { name, exact: typeof name === "string" });

test("For you comes from the real API, each card says why, and Not interested removes a card", async ({ page }) => {
  await page.goto("/community");
  const forYou = shelf(page, "For you");
  await expect(forYou).toBeVisible();
  const first = forYou.getByRole("article").first();
  await expect(first.getByTestId("reason")).not.toBeEmpty();
  const href = await first.getByRole("link").first().getAttribute("href");
  const id = Number(href?.split("/").pop());
  const title = (await first.getByRole("link").first().textContent()) ?? "";
  try {
    await first.getByRole("button", { name: "Not interested" }).click();
    await expect(forYou.getByRole("link", { name: title, exact: true })).toHaveCount(0);
    const recs = await (await page.request.get("/api/recommendations")).json();
    for (const s of recs.shelves) expect(s.items.map((i: { text: { id: number } }) => i.text.id)).not.toContain(id);
  } finally {
    await page.request.delete(`/api/recommendations/not-interested/${id}`);
  }
});

test("personalised shelves come first, in order, with their reasons", async ({ page }) => {
  const cards = await realCards(page, 4);
  await serve(page, fixture(cards));
  await page.goto("/community");
  const titles = ["Continue reading", "For you", "Because you liked Tapas en Madrid", "More about cooking", "Just right for you", "Stretch"];
  for (const t of titles) await expect(shelf(page, t)).toBeVisible();
  const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
  expect(headings.slice(0, titles.length)).toEqual(titles);
  await expect(shelf(page, "Continue reading").getByTestId("reason")).toHaveText("42% read");
  await expect(shelf(page, "For you").getByTestId("reason")).toHaveText(["96% known words", "Something different"]);
  await expect(shelf(page, "Because you liked Tapas en Madrid").getByTestId("reason")).toHaveText("Because you liked Tapas en Madrid");
  await expect(shelf(page, "Stretch").getByTestId("reason")).toHaveText("88% known words");
  // Continue reading isn't a recommendation to dismiss.
  await expect(shelf(page, "Continue reading").getByRole("button", { name: "Not interested" })).toHaveCount(0);
});

test("shown cards are logged once per shelf, and opening one logs an open", async ({ page }) => {
  const cards = await realCards(page, 4);
  const events = await serve(page, fixture(cards));
  await page.goto("/community");
  await expect(shelf(page, "For you")).toBeVisible();
  await expect.poll(() => events.filter((e) => e.type === "impression").length).toBe(6);
  expect(events.find((e) => e.shelf === "for-you")).toEqual({
    type: "impression", shelf: "for-you", items: [{ textId: cards[1].id, position: 0 }, { textId: cards[2].id, position: 1 }],
  });
  await shelf(page, "For you").getByRole("link", { name: String(cards[2].title), exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${cards[2].id}`));
  await expect.poll(() => events.filter((e) => e.type === "open")).toEqual([
    { type: "open", shelf: "for-you", items: [{ textId: cards[2].id, position: 1 }] },
  ]);
});

test("Not interested removes the card from every shelf at once", async ({ page }) => {
  const cards = await realCards(page, 4);
  await serve(page, fixture(cards));
  const marked: string[] = [];
  await page.route("**/api/recommendations/not-interested/*", (route: Route) => {
    marked.push(`${route.request().method()} ${route.request().url().split("/").pop()}`);
    return route.fulfill({ status: 204 });
  });
  await page.goto("/community");
  const stretchCard = shelf(page, "Stretch").getByRole("article");
  await stretchCard.getByRole("button", { name: "Not interested" }).click();
  await expect(shelf(page, "Stretch")).toHaveCount(0);
  await expect(shelf(page, /Because you liked/)).toHaveCount(0);
  await expect.poll(() => marked).toEqual([`PUT ${cards[3].id}`]);
});

test("See all on a topic shelf shows Explore filtered by that topic", async ({ page }) => {
  const cards = await realCards(page, 4);
  await serve(page, fixture(cards));
  const asked: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/library?")) asked.push(r.url());
  });
  await page.goto("/community");
  await shelf(page, "More about cooking").getByRole("button", { name: /See all/ }).click();
  await expect(page.getByRole("heading", { level: 2, name: "cooking" })).toBeVisible();
  await expect.poll(() => asked.some((u) => new URL(u).searchParams.get("topic") === "cooking")).toBe(true);
});

test("with no personalised shelves (nothing to recommend, or AI off) Explore still shows its category shelves", async ({ page }) => {
  await realCards(page, 1);
  await serve(page, { shelves: [] });
  await page.goto("/community");
  await expect(shelf(page, "For you")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /See all \d+/ }).first()).toBeVisible();
});

// Onboarding: PATCH /api/me (target language) and PUT interests are answered in the browser, never saved, so the
// shared test account keeps no target language and no interests.
test.describe("interests during onboarding", () => {
  test("picking at least three categories saves them as interests", async ({ page }) => {
    await page.goto("/library");
    const me = await (await page.request.get("/api/me")).json();
    await page.route("**/api/me", (route) => {
      if (route.request().method() !== "PATCH") return route.fallback();
      return route.fulfill({ json: { ...me, ...route.request().postDataJSON() } });
    });
    const saved: unknown[] = [];
    await page.route("**/api/recommendations/interests", (route) => {
      if (route.request().method() !== "PUT") return route.fulfill({ json: { categories: [] } });
      saved.push(route.request().postDataJSON());
      return route.fulfill({ json: route.request().postDataJSON() });
    });
    await page.goto("/onboarding?lang=fr");
    const interests = page.getByRole("group", { name: "What do you like?" });
    await expect(interests).toBeVisible();
    const save = interests.getByRole("button", { name: "Save interests" });
    await expect(save).toBeDisabled();
    for (const label of ["Food & cooking", "Travel"]) await interests.getByRole("button", { name: label }).click();
    await expect(save).toBeDisabled();
    await interests.getByRole("button", { name: "History" }).click();
    await expect(interests.getByRole("button", { name: "Travel" })).toHaveAttribute("aria-pressed", "true");
    await save.click();
    await expect(interests.getByText("Saved: we'll recommend more of these")).toBeVisible();
    expect(saved).toEqual([{ categories: ["travel", "food", "history"] }]);
    // Picking a starter text is still the way on (or skipping).
    await expect(page.getByRole("heading", { name: "Pick something to read" })).toBeVisible();
  });
});
