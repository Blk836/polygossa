import { expect, test, type Page } from "@playwright/test";
import {
  addSyncedAudio,
  bottomPager,
  cleanUp,
  createText as create,
  openReader,
  PAGE,
  pager,
  PER_SENTENCE,
  setReaderCookie,
  TALL,
  wordAt,
  type Created,
} from "./reader-helpers";

// Paging on its own: a 1,000-word text in one paragraph (like a transcript) of 10-word sentences, four pages of 250.
// "Turning the page marks new words known" is switched off here; reader-experience.spec.ts covers it. The window is
// tall enough for 250-word pages; reader-fit.spec.ts covers pages cut to fit shorter windows.
const WORDS = 1000;

test.use({ viewport: TALL });

let created: Created | null = null;

async function createText(page: Page, words = WORDS) {
  created = await create(page, words);
  return created.id;
}

const word = (n: number) => created!.word(n);

test.beforeEach(async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
});

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const article = (page: Page) => page.locator("article");
const finish = (page: Page) => page.getByRole("button", { name: "Finish lesson" });

/** Clicking a word saves it as "learning" (afterEach removes it). */
async function clickWord(page: Page, n: number) {
  await wordAt(page, n).click();
}

test("a short text is a single page with no page controls", async ({ page }) => {
  const id = await createText(page, 120);
  await openReader(page, `/read/${id}`);
  await expect(wordAt(page, 119)).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Pages" })).toHaveCount(0);
  await expect(finish(page)).toBeVisible();
});

test("a long transcript is split into pages of about 250 words", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  await expect(pager(page)).toContainText("Page 1 of 4");
  await expect(article(page).locator("[data-i]")).toHaveCount(PAGE);
  await expect(wordAt(page, 0)).toBeVisible();
  await expect(wordAt(page, PAGE)).toHaveCount(0);
  await expect(pager(page).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
});

test("Next and Previous turn pages and update the URL", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  const prev = pager(page).getByRole("button", { name: "Previous page" });
  const next = pager(page).getByRole("button", { name: "Next page" });
  await expect(prev).toBeDisabled();
  await expect(finish(page)).toHaveCount(0);

  await next.click();
  await expect(page).toHaveURL(new RegExp(`/read/${id}\\?page=2$`));
  await expect(pager(page)).toContainText("Page 2 of 4");
  await expect(wordAt(page, PAGE)).toBeVisible();
  await expect(wordAt(page, 0)).toHaveCount(0);

  await prev.click();
  await expect(pager(page)).toContainText("Page 1 of 4");
  await expect(wordAt(page, 0)).toBeVisible();

  await openReader(page, `/read/${id}?page=4`);
  await expect(next).toBeDisabled();
  await expect(wordAt(page, WORDS - 1)).toBeVisible();
  await expect(finish(page)).toBeVisible();
});

test("turning the page from the bottom scrolls back to the top of the text", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  await bottomPager(page).scrollIntoViewIfNeeded();
  await bottomPager(page).getByRole("button", { name: "Next page" }).click();
  await expect(pager(page)).toContainText("Page 2 of 4");
  await expect(wordAt(page, PAGE)).toBeInViewport();
});

test("Back returns to the previous page", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(pager(page)).toContainText("Page 2 of 4");
  await page.goBack();
  await expect(pager(page)).toContainText("Page 1 of 4");
  await expect(wordAt(page, 0)).toBeVisible();
});

test("arrow keys turn pages when no word is open", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  await expect(pager(page)).toContainText("Page 1 of 4");
  await page.keyboard.press("ArrowRight");
  await expect(pager(page)).toContainText("Page 2 of 4");
  await page.keyboard.press("ArrowRight");
  await expect(pager(page)).toContainText("Page 3 of 4");
  await page.keyboard.press("ArrowLeft");
  await expect(pager(page)).toContainText("Page 2 of 4");
});

test("arrow keys move from the last word of a page to the first word of the next", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  await clickWord(page, PAGE - 1);
  await expect(wordAt(page, PAGE - 1)).toHaveClass(/w-selected/);
  await page.keyboard.press("ArrowRight");
  await expect(pager(page)).toContainText("Page 2 of 4");
  await expect(wordAt(page, PAGE)).toHaveClass(/w-selected/);
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible(); // the popup is open
  await page.keyboard.press("ArrowLeft");
  await expect(pager(page)).toContainText("Page 1 of 4");
  await expect(wordAt(page, PAGE - 1)).toHaveClass(/w-selected/);
});

test("turning the page closes the popup and clears the selection", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  await clickWord(page, 5);
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(pager(page)).toContainText("Page 2 of 4");
  await expect(page.getByRole("button", { name: "Close", exact: true })).toHaveCount(0);
  await expect(article(page).locator(".w-selected")).toHaveCount(0);
  await pager(page).getByRole("button", { name: "Previous page" }).click();
  await expect(article(page).locator(".w-selected")).toHaveCount(0);
});

test("a direct link opens that page, server-rendered, and reload keeps it", async ({ page }) => {
  const id = await createText(page);
  const html = await (await page.request.get(`/read/${id}?page=3`)).text();
  expect(html).toContain(`>${word(2 * PAGE + 1)}<`);
  expect(html).not.toContain(`>${word(1)}<`);

  await openReader(page, `/read/${id}?page=3`);
  await expect(pager(page)).toContainText("Page 3 of 4");
  await page.reload();
  await expect(pager(page)).toContainText("Page 3 of 4");
  await expect(wordAt(page, 2 * PAGE)).toBeVisible();
});

test("an out-of-range or invalid page number shows the nearest valid page", async ({ page }) => {
  const id = await createText(page);
  for (const [raw, shown] of [["99", 4], ["0", 1], ["abc", 1]] as const) {
    await openReader(page, `/read/${id}?page=${raw}`);
    await expect(pager(page), `?page=${raw}`).toContainText(`Page ${shown} of 4`);
  }
});

test("reopening a text resumes on the last page read", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}?page=3`);
  await expect(pager(page)).toContainText("Page 3 of 4");
  await page.goto("/library");
  await openReader(page, `/read/${id}`);
  await expect(pager(page)).toContainText("Page 3 of 4");
  await expect(page).toHaveURL(new RegExp(`/read/${id}\\?page=3$`));
});

test("without browser storage the reader starts on page 1", async ({ page }) => {
  const id = await createText(page);
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openReader(page, `/read/${id}`);
  await expect(pager(page)).toContainText("Page 1 of 4");
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(pager(page)).toContainText("Page 2 of 4");
  expect(errors).toEqual([]);
});

test("stats in the header count the whole text, not just the page", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  const unique = WORDS - WORDS / PER_SENTENCE + 1; // every word is distinct except the repeated one
  await expect(page.getByText(`${unique} new · 0 learning`)).toBeVisible();
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText(`${unique} new · 0 learning`)).toBeVisible();
});

test("a word's status shows on every page", async ({ page }) => {
  const id = await createText(page);
  await openReader(page, `/read/${id}`);
  await clickWord(page, 0); // the repeated word
  await page.keyboard.press("k");
  await expect(wordAt(page, 0)).toHaveClass(/w-known/);
  await page.keyboard.press("Escape");
  await pager(page).getByRole("button", { name: "Next page" }).click();
  await expect(wordAt(page, PAGE)).toHaveClass(/w-known/);
});

test("stepping to the next sentence turns to the page holding it", async ({ page }) => {
  const id = await createText(page);
  await addSyncedAudio(page, id);
  await openReader(page, `/read/${id}`);
  for (let n = 0; n < PAGE / PER_SENTENCE; n++) await page.keyboard.press("]"); // past the last sentence of page 1
  await expect(pager(page)).toContainText("Page 2 of 4");
  await expect(wordAt(page, PAGE)).toHaveClass(/w-speaking/);
});

test("playing audio turns the page when the spoken word moves onto the next one", async ({ page }) => {
  const id = await createText(page);
  await addSyncedAudio(page, id);
  await openReader(page, `/read/${id}`);
  await clickWord(page, PAGE - 3);
  await page.getByRole("button", { name: "Play from here" }).click();
  await expect(pager(page)).toContainText("Page 2 of 4", { timeout: 10_000 });
  await expect(article(page).locator(".w-speaking")).toHaveCount(1);
  await page.getByRole("button", { name: "Pause" }).click();
});
