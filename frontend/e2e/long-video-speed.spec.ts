import { expect, test, type Page } from "@playwright/test";
import { cleanUp, createVideo, openReader, pager, setReaderCookie, wordAt, type Created } from "./reader-helpers";

const made: Created[] = [];

test.beforeEach(async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
});

test.afterEach(async ({ page }) => {
  for (const c of made.splice(0)) await cleanUp(page, c);
});

async function timeIt(action: () => Promise<void>): Promise<number> {
  const start = Date.now();
  await action();
  return Date.now() - start;
}

async function measure(page: Page, words: number) {
  const created = await createVideo(page, words);
  made.push(created);
  const open = await timeIt(async () => {
    await openReader(page, `/read/${created.id}`);
    await expect(wordAt(page, 0)).toBeVisible();
  });
  const turns: number[] = [];
  const clicks: number[] = [];
  for (let n = 2; n <= 4; n++) {
    turns.push(await timeIt(async () => {
      await pager(page).getByRole("button", { name: "Next page" }).click();
      await expect(pager(page)).toContainText(`Page ${n} of`);
    }));
    clicks.push(await timeIt(async () => {
      await page.locator("article [data-i]").first().click();
      await expect(page.locator("[data-word-popup]")).toBeVisible();
    }));
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-word-popup]")).toHaveCount(0);
  }
  return { open, turn: Math.min(...turns), click: Math.min(...clicks) };
}

test("a five-hour video lesson opens, turns pages and opens a word nearly as quickly as a short one", async ({ page }) => {
  test.setTimeout(240_000);
  const short = await measure(page, 9_000);
  const long = await measure(page, 27_000);
  test.info().annotations.push({ type: "timings", description: JSON.stringify({ short, long }) });
  expect(long.open, "opening").toBeLessThan(Math.max(short.open, 500) * 4);
  expect(long.turn, "turning a page").toBeLessThan(Math.max(short.turn, 150) * 3);
  expect(long.click, "opening a word").toBeLessThan(Math.max(short.click, 150) * 3);
});
