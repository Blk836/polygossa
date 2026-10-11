import { expect, test, type Page, type Route } from "@playwright/test";

type Json = Record<string, unknown>;

async function realCards(page: Page, count: number): Promise<Json[]> {
  await page.goto("/library");
  const res = await page.request.get(`/api/library?size=${count}`);
  const items = (await res.json()).items as Json[];
  expect(items.length, "the dev database needs some public content").toBeGreaterThanOrEqual(count);
  return items;
}

function rows(card: Json, title: string): Json {
  const text = { ...card, title };
  return {
    shelves: [
      { id: "continue", items: [{ text, reason: { kind: "progress", percent: 42 } }] },
      { id: "for-you", items: [{ text, reason: { kind: "explore" } }] },
    ],
  };
}

async function serveByFilter(page: Page, cards: Json[]) {
  const asked: URL[] = [];
  const answer = (route: Route) => {
    const url = new URL(route.request().url());
    asked.push(url);
    const kind = url.searchParams.get("kind");
    const level = url.searchParams.get("level");
    const title = level ? `Only ${level}` : kind === "video" ? "Only videos" : kind === "text" ? "Only texts" : "Everything";
    return route.fulfill({ json: rows(cards[0], title) });
  };
  await page.route("**/api/recommendations?**", answer);
  await page.route(/\/api\/recommendations$/, answer);
  await page.route("**/api/recommendations/events", (route) => route.fulfill({ status: 204 }));
  return asked;
}

const forYou = (page: Page) => page.getByRole("region", { name: "For you", exact: true });
const continueReading = (page: Page) => page.getByRole("region", { name: "Continue reading", exact: true });
const show = (page: Page, name: string) => page.getByRole("group", { name: "Show" }).getByRole("button", { name, exact: true });

test("picking Videos or Texts fetches and shows rows of only that kind, and All brings both back", async ({ page }) => {
  const cards = await realCards(page, 1);
  const asked = await serveByFilter(page, cards);
  await page.goto("/community");
  await expect(forYou(page).getByRole("link", { name: "Everything", exact: true })).toBeVisible();

  await show(page, "Videos").click();
  await expect(forYou(page).getByRole("link", { name: "Only videos", exact: true })).toBeVisible();
  await expect(continueReading(page).getByRole("link", { name: "Only videos", exact: true })).toBeVisible();
  await expect(forYou(page).getByRole("link", { name: "Everything", exact: true })).toHaveCount(0);
  expect(asked.at(-1)?.searchParams.get("kind")).toBe("video");

  await show(page, "Texts").click();
  await expect(forYou(page).getByRole("link", { name: "Only texts", exact: true })).toBeVisible();
  expect(asked.at(-1)?.searchParams.get("kind")).toBe("text");

  await show(page, "All").click();
  await expect(forYou(page).getByRole("link", { name: "Everything", exact: true })).toBeVisible();
  expect(asked.at(-1)?.searchParams.has("kind")).toBe(false);
});

test("picking a level fetches and shows rows of only that level", async ({ page }) => {
  const cards = await realCards(page, 1);
  const asked = await serveByFilter(page, cards);
  await page.goto("/community");
  await expect(forYou(page).getByRole("link", { name: "Everything", exact: true })).toBeVisible();
  await page.getByRole("combobox", { name: "Level" }).selectOption("B1");
  await expect(forYou(page).getByRole("link", { name: "Only B1", exact: true })).toBeVisible();
  expect(asked.at(-1)?.searchParams.get("level")).toBe("B1");
});
