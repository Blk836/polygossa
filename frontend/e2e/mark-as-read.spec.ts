import { expect, test, type Locator, type Page } from "@playwright/test";
import { cleanUp, createTextWith, createVideo, type Created } from "./reader-helpers";

let created: Created[] = [];
let playlist: number | null = null;

test.afterEach(async ({ page }) => {
  for (const c of created) await cleanUp(page, c);
  created = [];
  if (playlist) await page.request.delete(`/api/playlists/${playlist}`);
  playlist = null;
});

test.use({ viewport: { width: 1280, height: 900 } });

const WORDS = [1, 2, 3, 4, 5, 6, 7];

async function sevenWordText(page: Page) {
  const text = await createTextWith(page, (w) => `${WORDS.slice(0, 4).map(w).join(" ")}. ${WORDS.slice(4).map(w).join(" ")}.`);
  created.push(text);
  return text;
}

async function setStatus(page: Page, c: Created, n: number, status: "known" | "learning") {
  const res = await page.request.post("/api/vocabulary", { data: { language: c.language, term: c.word(n), status } });
  expect(res.ok(), await res.text()).toBe(true);
}

async function statuses(page: Page, c: Created): Promise<Record<string, string>> {
  const found = await (await page.request.get(`/api/vocabulary?language=${c.language}&q=${c.prefix}&size=200`)).json();
  return Object.fromEntries(((found.items ?? []) as { term: string; status: string }[]).map((e) => [e.term, e.status]));
}

const card = (page: Page, c: Created) => page.getByRole("main").getByRole("article").filter({ hasText: c.prefix }).first();
const confirmDialog = (page: Page) => page.getByRole("dialog", { name: /^Mark as (read|watched)\?$/ });
const finished = (l: Locator) => l.getByText("Finished", { exact: true });

async function openLibrary(page: Page, c: Created) {
  await page.goto("/library");
  await expect(card(page, c)).toBeVisible();
}

async function stubKnownCount(page: Page) {
  let calls = 0;
  await page.route("**/api/dashboard/header*", (route) => {
    calls++;
    return route.fulfill({ json: { current: 1, best: 1, activeToday: true, secondsLeftToday: 3600, knownWords: calls * 100 } });
  });
  return page.getByRole("banner").getByTestId("known-words");
}

test("a text's card offers Mark as read, a video's Mark as watched", async ({ page }) => {
  const text = await sevenWordText(page);
  const video = await createVideo(page, 20);
  created.push(video);
  await openLibrary(page, text);
  await expect(card(page, text).getByRole("button", { name: "Mark as read" })).toBeVisible();
  await expect(card(page, video).getByRole("button", { name: "Mark as watched" })).toBeVisible();
  await expect(card(page, text).getByRole("button", { name: "Mark as watched" })).toHaveCount(0);
});

test("the action is on cards in Explore's shelves and search results, and in a playlist", async ({ page }) => {
  const text = await sevenWordText(page);
  expect((await page.request.patch(`/api/texts/${text.id}`, { data: { isPublic: true, category: "travel" } })).ok()).toBe(true);

  await page.goto("/community");
  const shelf = page.getByRole("region", { name: "Travel" });
  await expect(shelf.getByRole("article").filter({ hasText: text.prefix }).getByRole("button", { name: "Mark as read" })).toBeVisible();

  await page.getByRole("searchbox", { name: "Search titles" }).fill(text.prefix);
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("card-grid").getByRole("article").filter({ hasText: text.prefix }).getByRole("button", { name: "Mark as read" })).toBeVisible();

  const res = await page.request.post("/api/playlists", { data: { title: `Mark check ${text.prefix}`, language: text.language } });
  expect(res.ok(), await res.text()).toBe(true);
  playlist = (await res.json()).id;
  expect((await page.request.put(`/api/playlists/${playlist}/items/${text.id}`)).ok()).toBe(true);
  await page.goto(`/playlists/${playlist}`);
  await expect(page.getByTestId("playlist-items").getByRole("article").getByRole("button", { name: "Mark as read" })).toBeVisible();
});

test("it asks first, saying how many new words will become known, and cancelling changes nothing", async ({ page }) => {
  const text = await sevenWordText(page);
  await setStatus(page, text, 1, "known");
  await setStatus(page, text, 2, "known");
  await setStatus(page, text, 3, "learning");
  const known = await stubKnownCount(page);
  await openLibrary(page, text);
  await expect(known).toHaveText("100 known");

  await card(page, text).getByRole("button", { name: "Mark as read" }).click();
  await expect(confirmDialog(page)).toBeVisible();
  await expect(confirmDialog(page)).toContainText("4 new words will be marked known");
  await expect(confirmDialog(page)).toContainText("Words you're learning keep their status");
  expect(Object.keys(await statuses(page, text))).toHaveLength(3);

  await confirmDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(confirmDialog(page)).toBeHidden();
  await expect(finished(card(page, text))).toHaveCount(0);
  await expect(card(page, text).getByRole("button", { name: "Mark as read" })).toBeVisible();
  expect(Object.keys(await statuses(page, text))).toHaveLength(3);
  await expect(known).toHaveText("100 known");
});

test("confirming finishes it as the reader would: new words known, learning words kept", async ({ page }) => {
  const text = await sevenWordText(page);
  await setStatus(page, text, 1, "known");
  await setStatus(page, text, 2, "known");
  await setStatus(page, text, 3, "learning");
  const known = await stubKnownCount(page);
  await openLibrary(page, text);
  await expect(known).toHaveText("100 known");

  await card(page, text).getByRole("button", { name: "Mark as read" }).click();
  const completed = page.waitForResponse((r) => r.url().endsWith(`/api/texts/${text.id}/complete`) && r.request().method() === "POST");
  await confirmDialog(page).getByRole("button", { name: "Mark as read" }).click();
  expect((await completed).ok()).toBe(true);

  await expect(confirmDialog(page)).toBeHidden();
  await expect(finished(card(page, text))).toBeVisible();
  await expect(card(page, text).getByTestId("difficulty")).toContainText("0% new words");
  await expect(card(page, text).getByRole("button", { name: "Mark as read" })).toHaveCount(0);
  await expect(known).not.toHaveText("100 known");

  const after = await statuses(page, text);
  expect(after[text.word(3)]).toBe("learning");
  for (const n of [1, 2, 4, 5, 6, 7]) expect(after[text.word(n)], text.word(n)).toBe("known");
});

test("a video marked as watched stays finished after a reload", async ({ page }) => {
  const video = await createVideo(page, 20);
  created.push(video);
  await openLibrary(page, video);
  await card(page, video).getByRole("button", { name: "Mark as watched" }).click();
  await confirmDialog(page).getByRole("button", { name: "Mark as watched" }).click();
  await expect(finished(card(page, video))).toBeVisible();

  await page.reload();
  await expect(finished(card(page, video))).toBeVisible();
  await expect(card(page, video).getByRole("button", { name: "Mark as watched" })).toHaveCount(0);
});

test("an item finished in the reader offers no action", async ({ page }) => {
  const text = await sevenWordText(page);
  expect((await page.request.post(`/api/texts/${text.id}/complete`)).ok()).toBe(true);
  await openLibrary(page, text);
  await expect(finished(card(page, text))).toBeVisible();
  await expect(card(page, text).getByRole("button", { name: "Mark as read" })).toHaveCount(0);
});

test("with no new words it still asks, saying no words will change, and confirming finishes it", async ({ page }) => {
  const text = await sevenWordText(page);
  for (const n of WORDS) await setStatus(page, text, n, "known");
  await openLibrary(page, text);
  await card(page, text).getByRole("button", { name: "Mark as read" }).click();
  await expect(confirmDialog(page)).toContainText("no words will change");
  await confirmDialog(page).getByRole("button", { name: "Mark as read" }).click();
  await expect(finished(card(page, text))).toBeVisible();
});

test("when marking fails, the error shows and the card stays as it was", async ({ page }) => {
  const text = await sevenWordText(page);
  await page.route(`**/api/texts/${text.id}/complete`, (route) =>
    route.fulfill({ status: 500, json: { code: "internal", message: "Something went wrong" } }));
  await openLibrary(page, text);
  await card(page, text).getByRole("button", { name: "Mark as read" }).click();
  await confirmDialog(page).getByRole("button", { name: "Mark as read" }).click();
  await expect(confirmDialog(page).getByRole("alert")).toBeVisible();
  await confirmDialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(finished(card(page, text))).toHaveCount(0);
  await expect(card(page, text).getByRole("button", { name: "Mark as read" })).toBeVisible();
  expect(Object.keys(await statuses(page, text))).toHaveLength(0);
});
