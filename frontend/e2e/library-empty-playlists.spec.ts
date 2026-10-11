import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createText, type Created } from "./reader-helpers";

const playlist = {
  id: 987654,
  title: "innerFrench 1-200",
  language: "fr",
  isPublic: false,
  owner: { id: 1, displayName: "Test User" },
  mine: true,
  itemCount: 197,
  completedCount: 1,
  covers: [],
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  bookmarked: false,
};

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

async function stub(page: Page, { playlists, texts }: { playlists: object[]; texts: object[] }) {
  await page.route(/\/api\/playlists(\?|$)/, (route) => route.fulfill({ json: playlists }));
  await page.route(/\/api\/playlists\/saved(\?|$)/, (route) => route.fulfill({ json: [] }));
  await page.route(/\/api\/texts(\?|$)/, (route) => {
    const videos = new URL(route.request().url()).searchParams.get("kind") === "video";
    return route.fulfill({ json: videos ? [] : texts });
  });
  await page.route(/\/api\/library\/bookmarks(\?|$)/, (route) => route.fulfill({ json: [] }));
}

const empty = (page: Page) => page.getByTestId("empty");

test.describe("the library's empty state knows about playlists", () => {
  test("with playlists but nothing saved, it says so quietly, without Import or Explore", async ({ page }) => {
    await stub(page, { playlists: [playlist], texts: [] });
    await page.goto("/library");
    await expect(page.getByRole("heading", { name: "Your playlists" })).toBeVisible();
    await expect(empty(page)).toContainText("Nothing saved outside your playlists");
    await expect(empty(page)).toContainText("Bookmark a text or video to keep it here.");
    await expect(empty(page).getByRole("link", { name: "Import a text or video" })).toHaveCount(0);
    await expect(empty(page).getByRole("link", { name: "Explore shared content" })).toHaveCount(0);
  });

  test("with nothing at all, it invites importing or exploring as before", async ({ page }) => {
    await stub(page, { playlists: [], texts: [] });
    await page.goto("/library");
    await expect(empty(page)).toContainText(/^No .*texts or videos yet/);
    await expect(empty(page).getByRole("link", { name: "Import a text or video" })).toBeVisible();
    await expect(empty(page).getByRole("link", { name: "Explore shared content" })).toBeVisible();
  });

  test("with playlists and filters that match nothing, it offers Clear filters as before", async ({ page }) => {
    created = await createText(page, 30);
    const story = (await (await page.request.get(`/api/texts/${created.id}`)).json()).text;
    await stub(page, { playlists: [playlist], texts: [{ ...story, mine: true }] });
    await page.goto("/library");
    await expect(page.getByTestId("card-grid").getByRole("article")).toHaveCount(1);
    await page.getByRole("region", { name: "Filter library" }).getByRole("button", { name: /^Filters/ }).click();
    await page.getByRole("dialog", { name: "Filters" }).getByRole("group", { name: "Show" }).getByRole("button", { name: "Videos" }).click();
    await page.keyboard.press("Escape");
    await expect(empty(page)).toContainText(/^No .*videos yet/);
    await expect(empty(page).getByRole("button", { name: "Clear filters" })).toBeVisible();
    await expect(empty(page)).not.toContainText("Nothing saved outside your playlists");
  });
});
