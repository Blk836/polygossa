import { expect, test, type Page } from "@playwright/test";

// Saving playlists like texts (docs/acceptance/saved-playlists.feature), and playlist cards showing a pointer.
// Data is created through the API and deleted after; the e2e user can save its own shared playlists, like its texts.

let textIds: number[] = [];
let playlistIds: number[] = [];
let tag = "";
let language = "es";

test.beforeEach(async ({ page }) => {
  await page.goto("/library"); // signs in (auto-login) and sets the session cookie used by page.request
  language = (await (await page.request.get("/api/me")).json()).targetLanguage ?? "es";
  tag = `ps${Math.floor(Math.random() * 1e9).toString(36)}`;
});

test.afterEach(async ({ page }) => {
  for (const id of playlistIds) await page.request.delete(`/api/playlists/${id}`);
  for (const id of textIds) await page.request.delete(`/api/texts/${id}`);
  textIds = [];
  playlistIds = [];
});

/** A shared playlist with one public text. */
async function sharedPlaylist(page: Page): Promise<number> {
  const text = await page.request.post("/api/texts", {
    data: { title: `Episode ${tag}`, language, content: `${tag}alpha.`, isPublic: true, category: "stories" },
  });
  expect(text.ok(), await text.text()).toBe(true);
  textIds.push((await text.json()).id);
  const res = await page.request.post("/api/playlists", { data: { title: `Podcast ${tag}`, language } });
  const id = (await res.json()).id as number;
  playlistIds.push(id);
  expect((await page.request.put(`/api/playlists/${id}/items/${textIds[0]}`)).ok()).toBe(true);
  expect((await page.request.patch(`/api/playlists/${id}`, { data: { isPublic: true } })).ok()).toBe(true);
  return id;
}

const card = (page: Page) => page.getByTestId("playlist-card").filter({ hasText: `Podcast ${tag}` });
const saveButton = (page: Page) => card(page).getByRole("button", { name: /^Save(d)?$/ });

async function isSaved(page: Page, id: number): Promise<boolean> {
  const list = (await (await page.request.get("/api/playlists/saved")).json()) as { id: number }[];
  return list.some((p) => p.id === id);
}

test("Explore's playlist cards have a Save button that keeps its state", async ({ page }) => {
  const id = await sharedPlaylist(page);
  await page.goto("/community");
  await expect(saveButton(page)).toHaveText("Save");
  await expect(saveButton(page)).toHaveAttribute("aria-pressed", "false");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveText("Saved");
  await expect(saveButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("dialog")).toBeHidden(); // saving doesn't open the playlist
  await expect.poll(() => isSaved(page, id)).toBe(true);
  await page.reload();
  await expect(saveButton(page)).toHaveText("Saved");
});

test("saved playlists are in My library's playlists row, once, and can be unsaved there", async ({ page }) => {
  const id = await sharedPlaylist(page);
  expect((await page.request.put(`/api/playlists/${id}/bookmark`)).ok()).toBe(true);
  await page.goto("/library");
  const shelf = page.getByRole("region", { name: "Your playlists" });
  await expect(shelf.getByTestId("playlist-card").filter({ hasText: `Podcast ${tag}` })).toHaveCount(1); // mine and saved: once
  await expect(shelf.getByRole("link", { name: "All playlists →" })).toBeVisible();
  await expect(saveButton(page)).toHaveText("Saved");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveText("Save");
  await expect.poll(() => isSaved(page, id)).toBe(false);
});

test("someone else's saved playlist shows in My library's row and on the playlists page", async ({ page }) => {
  const id = await sharedPlaylist(page);
  expect((await page.request.put(`/api/playlists/${id}/bookmark`)).ok()).toBe(true);
  // Seen as another learner's playlist: the e2e user is the only account, so it is left out of "mine".
  await page.route(/\/api\/playlists(\?|$)/, async (route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: ((await res.json()) as { id: number }[]).filter((p) => p.id !== id) });
  });
  for (const path of ["/library", "/playlists"]) {
    await page.goto(path);
    await expect(card(page)).toHaveCount(1);
    await expect(saveButton(page)).toHaveText("Saved");
  }
});

test("the playlists page has no Shared switch or search; my own unsaved playlists have no Save button", async ({ page }) => {
  await sharedPlaylist(page);
  await page.goto("/playlists");
  await expect(card(page)).toBeVisible();
  await expect(saveButton(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Shared", exact: true })).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Search playlists" })).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Playlist name" })).toBeVisible();
});

test("someone else's playlist page has a Save button", async ({ page }) => {
  const id = await sharedPlaylist(page);
  // Seen as another learner would see it: the e2e user is the only account, so mark it as not ours.
  await page.route(`**/api/playlists/${id}`, async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const res = await route.fetch();
    const body = await res.json();
    body.playlist.mine = false;
    await route.fulfill({ response: res, json: body });
  });
  await page.goto(`/playlists/${id}`);
  const save = page.getByRole("button", { name: /^Save(d)?$/ });
  await expect(save).toHaveText("Save");
  await save.click();
  await expect(save).toHaveText("Saved");
  await expect.poll(() => isSaved(page, id)).toBe(true);
});

test("a save the server rejects goes back to Save", async ({ page }) => {
  await sharedPlaylist(page);
  await page.route("**/api/playlists/*/bookmark", (route) => route.fulfill({ status: 500, json: { code: "error", message: "Nope" } }));
  await page.goto("/community");
  await saveButton(page).click();
  await expect(saveButton(page)).toHaveText("Save");
  await expect(saveButton(page)).toHaveAttribute("aria-pressed", "false");
});

test("hovering a playlist card shows the pointer, like a text card", async ({ page }) => {
  await sharedPlaylist(page);
  await page.goto("/community");
  // Other playlists in the dev database can push the card below the fold, where elementFromPoint finds nothing, and
  // cards still loading above it can move it after it was measured: measure again until both points show the pointer.
  await expect.poll(async () => {
    await card(page).scrollIntoViewIfNeeded();
    const box = (await card(page).boundingBox())!;
    const points = [0.3, 0.6].map((y) => [box.x + box.width / 2, box.y + box.height * y]);
    return page.evaluate((points) => points.map(([x, y]) => {
      const element = document.elementFromPoint(x, y);
      return element ? getComputedStyle(element).cursor : "nothing there";
    }), points);
  }).toEqual(["pointer", "pointer"]);
});
