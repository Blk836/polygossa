import { expect, test, type Page } from "@playwright/test";
import { addSyncedAudio, cleanUp, createText, openReader, PAGE, pager, PER_SENTENCE, setReaderCookie, TALL, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.use({ viewport: TALL });

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

function markKnownCalls(page: Page) {
  const calls: { fromToken: number; toToken: number }[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/mark-known") && r.method() === "POST") calls.push(r.postDataJSON());
  });
  return calls;
}

async function stubKnownCount(page: Page) {
  let calls = 0;
  await page.route("**/api/dashboard/header*", (route) => {
    calls++;
    return route.fulfill({ json: { current: 1, best: 1, activeToday: true, secondsLeftToday: 3600, knownWords: calls * 100 } });
  });
  return () => calls;
}

const known = (page: Page) => page.getByRole("banner").getByTestId("known-words");

async function readerWithAudio(page: Page, seconds = 60) {
  created = await createText(page);
  await addSyncedAudio(page, created.id, seconds);
  await openReader(page, `/read/${created.id}`);
}

async function playAcrossFirstPage(page: Page) {
  await wordAt(page, PAGE - 3).click();
  await page.getByRole("button", { name: "Play from here" }).click();
  await expect(pager(page)).toContainText("Page 2 of 4", { timeout: 10_000 });
  await page.getByRole("button", { name: "Pause" }).click();
}

test("playback turning the page marks the page known and updates the count, like Next", async ({ page }) => {
  const headerCalls = await stubKnownCount(page);
  const calls = markKnownCalls(page);
  await readerWithAudio(page);
  await expect(known(page)).toHaveText(`${headerCalls() * 100} known`);
  const before = await known(page).textContent();
  const saved = page.waitForResponse((r) => r.url().includes("/mark-known") && r.request().method() === "POST");
  await playAcrossFirstPage(page);
  expect((await saved).ok()).toBe(true);
  expect(calls).toHaveLength(1);
  expect(calls[0].fromToken).toBe(0);
  expect(calls[0].toToken).toBeLessThan(2 * PAGE);
  await expect(wordAt(page, PAGE)).toHaveClass(/w-known/);
  await expect(known(page)).not.toHaveText(before!);
});

test("stepping with ] across the page end marks it known, and stepping back with [ marks nothing", async ({ page }) => {
  const calls = markKnownCalls(page);
  await readerWithAudio(page, 1000);
  const saved = page.waitForResponse((r) => r.url().includes("/mark-known") && r.request().method() === "POST");
  for (let n = 0; n < PAGE / PER_SENTENCE; n++) await page.keyboard.press("]");
  await expect(pager(page)).toContainText("Page 2 of 4");
  expect((await saved).ok()).toBe(true);
  await expect(wordAt(page, PAGE)).toHaveClass(/w-known/);
  await expect(wordAt(page, PAGE + 1)).toHaveClass(/w-new/);
  await page.keyboard.press("[");
  await expect(pager(page)).toContainText("Page 1 of 4");
  await page.keyboard.press("]");
  await expect(pager(page)).toContainText("Page 2 of 4");
  await expect(wordAt(page, PAGE + 1)).toHaveClass(/w-new/);
  expect(calls).toHaveLength(1);
});

test("with marking pages known turned off, playback turning the page marks nothing", async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
  const calls = markKnownCalls(page);
  await readerWithAudio(page);
  await playAcrossFirstPage(page);
  await expect(wordAt(page, PAGE)).toHaveClass(/w-new/);
  expect(calls).toHaveLength(0);
});

test("when marking the page known fails, playback still turns the page and the error shows", async ({ page }) => {
  await page.route("**/api/texts/*/mark-known", (route) => route.fulfill({ status: 500, json: { code: "boom", message: "Could not save" } }));
  await readerWithAudio(page);
  await playAcrossFirstPage(page);
  await expect(page.getByRole("alert").filter({ hasText: "Could not save" })).toBeVisible();
  await expect(wordAt(page, PAGE)).toHaveClass(/w-new/);
});
