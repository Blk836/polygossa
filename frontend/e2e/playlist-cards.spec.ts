import { expect, test, type Page } from "@playwright/test";

let textIds: number[] = [];
let playlistIds: number[] = [];
let tag = "";
let language = "es";

test.beforeEach(async ({ page }) => {
  await page.goto("/library");
  language = (await (await page.request.get("/api/me")).json()).targetLanguage ?? "es";
  tag = `pc${Math.floor(Math.random() * 1e9).toString(36)}`;
});

test.afterEach(async ({ page }) => {
  for (const id of playlistIds) await page.request.delete(`/api/playlists/${id}`);
  for (const id of textIds) await page.request.delete(`/api/texts/${id}`);
  textIds = [];
  playlistIds = [];
});

async function createText(page: Page, name: string): Promise<number> {
  const res = await page.request.post("/api/texts", {
    data: { title: `${name} ${tag}`, language, content: `${tag}alpha ${tag}beta.`, isPublic: true, category: "stories" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const id = (await res.json()).id as number;
  textIds.push(id);
  return id;
}

async function createPlaylist(page: Page, count: number, isPublic = false): Promise<{ id: number; items: number[] }> {
  const res = await page.request.post("/api/playlists", { data: { title: `Podcast ${tag}`, language } });
  const id = (await res.json()).id as number;
  playlistIds.push(id);
  const items: number[] = [];
  for (let i = 1; i <= count; i++) {
    const text = await createText(page, `Episode ${i}`);
    expect((await page.request.put(`/api/playlists/${id}/items/${text}`)).ok()).toBe(true);
    items.push(text);
  }
  if (isPublic) await page.request.patch(`/api/playlists/${id}`, { data: { isPublic: true } });
  return { id, items };
}

const playlistCard = (page: Page) => page.getByTestId("playlist-card").filter({ hasText: `Podcast ${tag}` });
const pane = (page: Page) => page.getByRole("dialog", { name: `Podcast ${tag}` });

test("a playlist card is labelled as a playlist and shows its first episodes as a fanned deck", async ({ page }) => {
  await createPlaylist(page, 4);
  await page.goto("/playlists");
  const card = playlistCard(page);
  await expect(card.getByText("Playlist", { exact: true })).toBeVisible();
  await expect(card).toContainText("4 items");
  const covers = card.getByTestId("deck-card");
  await expect(covers).toHaveCount(3);
  await expect(covers.nth(2)).toHaveAttribute("title", `Episode 1 ${tag}`);
  await expect(covers.nth(0)).toHaveAttribute("title", `Episode 3 ${tag}`);
  const transforms = await covers.evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
  expect(transforms[2]).toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
  expect(transforms[0]).not.toBe(transforms[1]);
});

test("a playlist card is the size of a text card", async ({ page }) => {
  await createText(page, "Alone");
  await createPlaylist(page, 2);
  await page.goto("/library");
  const textCard = page.getByTestId("card-grid").getByRole("article").filter({ hasText: `Alone ${tag}` });
  const shelfCard = playlistCard(page);
  await expect(shelfCard).toBeVisible();
  await page.goto("/playlists");
  const gridCard = playlistCard(page);
  await expect(gridCard).toBeVisible();
  const gridBox = (await gridCard.boundingBox())!;
  await page.goto("/library");
  const textBox = (await textCard.boundingBox())!;
  expect(Math.abs(gridBox.width - textBox.width)).toBeLessThan(2);
});

test("clicking a playlist opens a pane with a scrollable list of every episode", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 700 });
  const { id, items } = await createPlaylist(page, 12);
  await page.goto("/playlists");
  await playlistCard(page).getByRole("button", { name: `Podcast ${tag}` }).click();
  await expect(pane(page)).toBeVisible();
  const box = (await pane(page).boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - 640)).toBeLessThan(2);
  expect(Math.abs(box.y + box.height / 2 - 350)).toBeLessThan(2);
  expect(box.x).toBeGreaterThan(100);
  expect(box.y).toBeGreaterThan(0);
  const list = pane(page).getByTestId("playlist-pane-items");
  await expect(list.getByRole("listitem")).toHaveCount(12);
  await expect(list.getByRole("listitem").first()).toContainText(`Episode 1 ${tag}`);
  await expect(list.getByRole("listitem").last()).toContainText(`Episode 12 ${tag}`);
  const scrolls = await list.evaluate((el) => el.scrollHeight > el.clientHeight && getComputedStyle(el).overflowY !== "visible");
  expect(scrolls).toBe(true);
  await list.getByRole("listitem").last().scrollIntoViewIfNeeded();
  await expect(list.getByRole("link", { name: `Episode 12 ${tag}` })).toBeInViewport();

  await page.keyboard.press("Escape");
  await expect(pane(page)).toBeHidden();
  await playlistCard(page).getByRole("button", { name: `Podcast ${tag}` }).click();
  await pane(page).getByRole("link", { name: `Episode 3 ${tag}` }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${items[2]}\\?playlist=${id}`));
  await expect(page.getByTestId("reader-playlist")).toContainText("3 of 12");
});

test("on a phone the playlist opens as a bottom sheet: full width, docked to the bottom, scrollable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await createPlaylist(page, 12);
  await page.goto("/playlists");
  await playlistCard(page).getByRole("button", { name: `Podcast ${tag}` }).click();
  await expect(pane(page)).toBeVisible();
  await expect(pane(page).getByTestId("playlist-pane-items").getByRole("listitem")).toHaveCount(12);
  const box = (await pane(page).boundingBox())!;
  expect(box.x).toBe(0);
  expect(Math.abs(box.width - 390)).toBeLessThan(1);
  expect(Math.abs(box.y + box.height - 844)).toBeLessThan(1);
  expect(box.height).toBeLessThanOrEqual(844 * 0.9 + 1);
  const list = pane(page).getByTestId("playlist-pane-items");
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await pane(page).getByRole("button", { name: "Close" }).click();
  await expect(pane(page)).toBeHidden();
});

test("the pane starts or continues the playlist and links to its page", async ({ page }) => {
  const { id, items } = await createPlaylist(page, 3);
  await page.request.post(`/api/texts/${items[0]}/complete`);
  await page.goto("/playlists");
  await playlistCard(page).getByRole("button", { name: `Podcast ${tag}` }).click();
  await expect(pane(page)).toContainText("3 items · 1 finished");
  await expect(pane(page).getByRole("listitem").first()).toContainText("Finished");
  await expect(pane(page).getByRole("link", { name: "Continue" })).toHaveAttribute("href", `/read/${items[1]}?playlist=${id}`);
  await pane(page).getByRole("button", { name: "Close" }).click();
  await expect(pane(page)).toBeHidden();
  await playlistCard(page).getByRole("button", { name: `Podcast ${tag}` }).click();
  await pane(page).getByRole("link", { name: "Playlist page" }).click();
  await expect(page).toHaveURL(new RegExp(`/playlists/${id}$`));
});

test("Library shows your playlists and Explore shows shared ones, as cards", async ({ page }) => {
  await createPlaylist(page, 2, true);
  await page.goto("/library");
  await expect(page.getByRole("region", { name: "Your playlists" }).getByTestId("playlist-card").filter({ hasText: `Podcast ${tag}` })).toBeVisible();
  await page.goto("/community");
  const shared = page.getByRole("region", { name: "Playlists" }).getByTestId("playlist-card").filter({ hasText: `Podcast ${tag}` });
  await expect(shared).toBeVisible();
  await shared.getByRole("button", { name: `Podcast ${tag}` }).click();
  await expect(pane(page).getByRole("listitem")).toHaveCount(2);
});
