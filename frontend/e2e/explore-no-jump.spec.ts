import { expect, test, type Page, type Route } from "@playwright/test";

// docs/acceptance/explore-no-jump.feature: Explore's rows (picked for you, playlists, categories) appear together, in
// their final order.

let textId: number | null = null;

test.afterEach(async ({ page }) => {
  if (textId) await page.request.delete(`/api/texts/${textId}`);
  textId = null;
});

/** A text of mine, as the cards list it, to stand in a "Continue reading" row. */
async function myText(page: Page) {
  await page.goto("/library");
  const title = `No jump ${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  const res = await page.request.post("/api/texts", {
    data: { title, language: "fr", content: "Le chat dort sur le canapé.", isPublic: false, category: "other" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  textId = (await res.json()).id;
  const list = await (await page.request.get("/api/texts")).json();
  return list.find((t: { id: number }) => t.id === textId);
}

const playlist = {
  id: 987654, title: "Stub shared playlist", language: "fr", isPublic: true, mine: false, itemCount: 2, completedCount: 0,
  owner: { id: 1, displayName: "Someone", photoUrl: null }, covers: [], createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z", bookmarked: false,
};

/** Shared playlists answer at once; the rows picked for me wait until `release()`. */
async function stub(page: Page, text: unknown) {
  await page.route(/\/api\/playlists\/shared(\?.*)?$/, (route) => route.fulfill({ json: [playlist] }));
  let release!: () => void;
  let released = new Promise<void>((resolve) => (release = resolve));
  const answer = (route: Route) =>
    released.then(() => route.fulfill({ json: { shelves: [{ id: "continue", items: [{ text, reason: { kind: "progress", percent: 10 } }] }] } }));
  await page.route(/\/api\/recommendations(\?.*)?$/, (route) => (route.request().method() === "GET" ? answer(route) : route.fallback()));
  return {
    release: () => release(),
    holdAgain: () => (released = new Promise<void>((resolve) => (release = resolve))),
  };
}

const heading = (page: Page, name: string) => page.getByRole("heading", { level: 2, name, exact: true });

async function expectFinalOrder(page: Page) {
  const continueAt = (await heading(page, "Continue reading").boundingBox())!.y;
  const playlistsAt = (await heading(page, "Playlists").boundingBox())!.y;
  const firstCategoryAt = (await page.locator("main section[aria-labelledby^='shelf-'] h2").first().boundingBox())!.y;
  expect(continueAt).toBeLessThan(playlistsAt);
  expect(playlistsAt).toBeLessThan(firstCategoryAt);
}

test("nothing shows in the wrong place while the rows picked for me load", async ({ page }) => {
  const text = await myText(page);
  const rows = await stub(page, text);

  await page.goto("/community");
  await expect(page.getByTestId("section-loading")).toBeVisible();
  await page.waitForTimeout(500); // playlists and category rows have answered by now
  await expect(heading(page, "Playlists")).toHaveCount(0);
  await expect(page.locator("main section[aria-labelledby^='shelf-']")).toHaveCount(0);

  rows.release();
  await expect(heading(page, "Continue reading")).toBeVisible();
  await expect(heading(page, "Playlists")).toBeVisible();
  await expectFinalOrder(page);
});

test("coming back to Explore shows the rows at once, in the same order", async ({ page }) => {
  const text = await myText(page);
  const rows = await stub(page, text);
  await page.goto("/community");
  rows.release();
  await expect(heading(page, "Continue reading")).toBeVisible();
  await page.getByRole("link", { name: "My library", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My library" })).toBeVisible();
  rows.holdAgain();

  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(heading(page, "Continue reading")).toBeVisible({ timeout: 2000 });
  await expect(heading(page, "Playlists")).toBeVisible();
  await expectFinalOrder(page);
  rows.release();
});

test("rows that can't load don't hold the page", async ({ page }) => {
  await page.route(/\/api\/recommendations(\?.*)?$/, (route) =>
    route.request().method() === "GET" ? route.fulfill({ status: 500, json: { code: "error", message: "down" } }) : route.fallback(),
  );
  await page.route(/\/api\/playlists\/shared(\?.*)?$/, (route) => route.fulfill({ status: 500, json: { code: "error", message: "down" } }));

  await page.goto("/community");
  await expect(page.locator("main section[aria-labelledby^='shelf-']").first()).toBeVisible();
  await expect(page.getByTestId("section-loading")).toHaveCount(0);
});
