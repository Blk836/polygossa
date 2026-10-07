import { expect, test, type Page } from "@playwright/test";

// Playlists: group texts and videos (a text can be in several), order them, read through them, and share them.
// Everything is created through the API with a unique tag in its title, and deleted afterwards.

let textIds: number[] = [];
let playlistIds: number[] = [];
let tag = "";
let language = "es";

test.beforeEach(async ({ page }) => {
  await page.goto("/library"); // signs in (auto-login) and sets the session cookie used by page.request
  language = (await (await page.request.get("/api/me")).json()).targetLanguage ?? "es";
  tag = `pl${Math.floor(Math.random() * 1e9).toString(36)}`;
});

test.afterEach(async ({ page }) => {
  for (const id of playlistIds) await page.request.delete(`/api/playlists/${id}`);
  for (const id of textIds) await page.request.delete(`/api/texts/${id}`);
  textIds = [];
  playlistIds = [];
});

async function createText(page: Page, name: string, isPublic = false): Promise<number> {
  const res = await page.request.post("/api/texts", {
    data: { title: `${name} ${tag}`, language, content: `${tag}alpha ${tag}beta. ${tag}gamma.`, isPublic, category: "other" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  const id = (await res.json()).id as number;
  textIds.push(id);
  return id;
}

async function createPlaylist(page: Page, name: string, items: number[] = [], isPublic = false): Promise<number> {
  const res = await page.request.post("/api/playlists", { data: { title: `${name} ${tag}`, language } });
  expect(res.ok(), await res.text()).toBe(true);
  const id = (await res.json()).id as number;
  playlistIds.push(id);
  for (const text of items) expect((await page.request.put(`/api/playlists/${id}/items/${text}`)).ok()).toBe(true);
  if (isPublic) await page.request.patch(`/api/playlists/${id}`, { data: { isPublic: true } });
  return id;
}

async function itemTitles(page: Page, playlist: number): Promise<string[]> {
  const detail = await (await page.request.get(`/api/playlists/${playlist}`)).json();
  return (detail.items as { title: string }[]).map((t) => t.title.replace(` ${tag}`, ""));
}

const card = (page: Page, name: string) => page.getByTestId("card-grid").getByRole("article").filter({ hasText: `${name} ${tag}` });
const addDialog = (page: Page) => page.getByRole("dialog", { name: "Add to playlist" });
const row = (page: Page, name: string) => page.getByTestId("playlist-items").getByRole("article").filter({ hasText: `${name} ${tag}` });

test("creates a playlist from a library card and adds the text to it", async ({ page }) => {
  await createText(page, "Lesson");
  await page.goto("/library");
  await card(page, "Lesson").getByRole("button", { name: "Add to playlist" }).click();
  await addDialog(page).getByLabel("New playlist").fill(`Commute ${tag}`);
  await addDialog(page).getByRole("button", { name: "Create" }).click();
  await expect(addDialog(page).getByRole("checkbox", { name: `Commute ${tag}` })).toBeChecked();
  const mine = await (await page.request.get(`/api/playlists?language=${language}`)).json();
  const created = mine.find((p: { title: string }) => p.title === `Commute ${tag}`);
  playlistIds.push(created.id);
  expect(await itemTitles(page, created.id)).toEqual(["Lesson"]);

  await addDialog(page).getByRole("button", { name: "Done" }).click();
  await page.goto("/playlists");
  const tile = page.getByTestId("playlist-card").filter({ hasText: `Commute ${tag}` });
  await expect(tile).toContainText("1 item");
  await tile.getByRole("button", { name: `Commute ${tag}` }).click();
  await page.getByRole("dialog", { name: `Commute ${tag}` }).getByRole("link", { name: "Playlist page" }).click();
  await expect(page).toHaveURL(new RegExp(`/playlists/${created.id}$`));
  await expect(row(page, "Lesson")).toBeVisible();
});

test("puts one text in two playlists, and takes it out of one", async ({ page }) => {
  const text = await createText(page, "Shared lesson");
  const first = await createPlaylist(page, "First");
  const second = await createPlaylist(page, "Second");
  await page.goto("/library");
  await card(page, "Shared lesson").getByRole("button", { name: "Add to playlist" }).click();
  await addDialog(page).getByRole("checkbox", { name: `First ${tag}` }).check();
  await addDialog(page).getByRole("checkbox", { name: `Second ${tag}` }).check();
  await expect.poll(() => itemTitles(page, first)).toEqual(["Shared lesson"]);
  await expect.poll(() => itemTitles(page, second)).toEqual(["Shared lesson"]);
  await addDialog(page).getByRole("checkbox", { name: `First ${tag}` }).uncheck();
  await expect.poll(() => itemTitles(page, first)).toEqual([]);
  expect(await itemTitles(page, second)).toEqual(["Shared lesson"]);
  expect((await page.request.get(`/api/texts/${text}`)).ok()).toBe(true);
});

test("the owner reorders and removes items", async ({ page }) => {
  const ids = [await createText(page, "One"), await createText(page, "Two"), await createText(page, "Three")];
  const playlist = await createPlaylist(page, "Order", ids);
  await page.goto(`/playlists/${playlist}`);
  await row(page, "One").getByRole("button", { name: "Move down" }).click();
  await expect.poll(() => itemTitles(page, playlist)).toEqual(["Two", "One", "Three"]);
  await expect(page.getByTestId("playlist-items").getByRole("article").first()).toContainText(`Two ${tag}`);
  await row(page, "Three").getByRole("button", { name: "Move up" }).click();
  await expect.poll(() => itemTitles(page, playlist)).toEqual(["Two", "Three", "One"]);
  await row(page, "Three").getByRole("button", { name: "Remove from playlist" }).click();
  await expect(row(page, "Three")).toHaveCount(0);
  await expect.poll(() => itemTitles(page, playlist)).toEqual(["Two", "One"]);
});

test("the owner shares a playlist, which then shows in the Shared tab", async ({ page }) => {
  const playlist = await createPlaylist(page, "Podcast", [await createText(page, "Episode", true)]);
  await page.goto(`/playlists/${playlist}`);
  await expect(page.getByTestId("playlist-status")).toHaveText("Private");
  await page.getByRole("button", { name: "Share" }).click();
  await expect(page.getByTestId("playlist-status")).toHaveText("Shared");
  expect((await (await page.request.get(`/api/playlists/${playlist}`)).json()).playlist.isPublic).toBe(true);
  await expect(page.getByRole("button", { name: "Copy link" })).toBeVisible();

  await page.goto("/playlists");
  await page.getByRole("button", { name: "Shared" }).click();
  await page.getByLabel("Search playlists").fill(`Podcast ${tag}`);
  await page.getByLabel("Search playlists").press("Enter");
  await expect(page.getByRole("article").filter({ hasText: `Podcast ${tag}` })).toContainText("1 item");
});

test("warns the owner when a shared playlist holds private items", async ({ page }) => {
  const playlist = await createPlaylist(page, "Mixed", [await createText(page, "Open", true), await createText(page, "Closed")], true);
  await page.goto(`/playlists/${playlist}`);
  await expect(page.getByText("1 item is private, so only you can see it")).toBeVisible();
});

test("reads through a playlist: Start, the reader's place in it, and Next", async ({ page }) => {
  const a = await createText(page, "Part one");
  const b = await createText(page, "Part two");
  const playlist = await createPlaylist(page, "Course", [a, b]);
  await page.goto(`/playlists/${playlist}`);
  await page.getByRole("link", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${a}\\?playlist=${playlist}`));
  const strip = page.getByTestId("reader-playlist");
  await expect(strip).toContainText(`Course ${tag}`);
  await expect(strip).toContainText("1 of 2");
  await strip.getByRole("link", { name: /Next/ }).click();
  await expect(page).toHaveURL(new RegExp(`/read/${b}\\?playlist=${playlist}`));
  await expect(page.getByTestId("reader-playlist")).toContainText("2 of 2");
  await expect(page.getByTestId("reader-playlist").getByRole("link", { name: /Next/ })).toHaveCount(0);
  await page.getByTestId("reader-playlist").getByRole("link", { name: `Course ${tag}` }).click();
  await expect(page).toHaveURL(new RegExp(`/playlists/${playlist}$`));
});

test("Continue picks up at the first unfinished item", async ({ page }) => {
  const a = await createText(page, "Done");
  const b = await createText(page, "Next up");
  const playlist = await createPlaylist(page, "Resume", [a, b]);
  await page.request.post(`/api/texts/${a}/complete`);
  await page.goto(`/playlists/${playlist}`);
  await expect(page.getByText("2 items · 1 finished")).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue" })).toHaveAttribute("href", `/read/${b}?playlist=${playlist}`);
});

test("adds the open text to a playlist from the reader", async ({ page }) => {
  const text = await createText(page, "Reading");
  const playlist = await createPlaylist(page, "From reader");
  await page.goto(`/read/${text}`);
  await page.getByRole("button", { name: "Add to playlist" }).click();
  await addDialog(page).getByRole("checkbox", { name: `From reader ${tag}` }).check();
  await expect.poll(() => itemTitles(page, playlist)).toEqual(["Reading"]);
});

test("renames and deletes a playlist, keeping its texts", async ({ page }) => {
  const text = await createText(page, "Kept");
  const playlist = await createPlaylist(page, "Old name", [text]);
  await page.goto(`/playlists/${playlist}`);
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Title").fill(`New name ${tag}`);
  await page.getByLabel("Description").fill("Short stories");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: `New name ${tag}` })).toBeVisible();
  await expect(page.getByText("Short stories")).toBeVisible();

  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Delete playlist" }).click();
  await expect(page).toHaveURL(/\/playlists$/);
  expect((await page.request.get(`/api/playlists/${playlist}`)).status()).toBe(404);
  expect((await page.request.get(`/api/texts/${text}`)).ok()).toBe(true);
});

test("an unknown playlist shows not found", async ({ page }) => {
  await page.goto("/playlists/999999999");
  await expect(page.getByText("Playlist not found")).toBeVisible();
});
