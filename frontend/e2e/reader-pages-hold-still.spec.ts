import { expect, test, type Page } from "@playwright/test";
import {
  addSyncedAudio,
  article,
  bottomPager,
  cleanUp,
  createText,
  createVideo,
  fakeYouTube,
  openReader,
  pager,
  player,
  setReaderCookie,
  type Created,
} from "./reader-helpers";

let created: Created | null = null;

test.use({ launchOptions: { ignoreDefaultArgs: ["--hide-scrollbars"] } });

test.beforeEach(async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
  await fakeYouTube(page);
});

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
const pageCount = async (page: Page) => Number((await pager(page).textContent())!.match(/of (\d+)/)![1]);
const wordsShown = (page: Page) => article(page).locator("[data-i]");
const firstWord = async (page: Page) => Number(await wordsShown(page).first().getAttribute("data-i"));
const lines = (page: Page) =>
  article(page).evaluate((a) => Math.round(a.getBoundingClientRect().height / parseFloat(getComputedStyle(a).lineHeight)));
const nextPage = (page: Page) => bottomPager(page).getByRole("button", { name: "Next page" }).click();

async function video(page: Page) {
  const frame = page.getByTestId("video-dock").locator("iframe");
  await expect(frame).toBeVisible();
  return (await frame.boundingBox())!;
}

async function openVideo(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  created = await createVideo(page);
  await openReader(page, `/read/${created.id}`);
  await expect(player(page)).toBeVisible();
}

async function readThrough(page: Page, check: (n: number) => Promise<void>) {
  const count = await pageCount(page);
  let words = 0;
  for (let n = 1; n <= count; n++) {
    await expect(pager(page)).toContainText(`Page ${n} of ${count}`);
    await check(n);
    words += await wordsShown(page).count();
    if (n < count) await nextPage(page);
  }
  return words;
}

test("the video gives way so three lines of text fit, and no page scrolls", async ({ page }) => {
  await openVideo(page, { width: 930, height: 810 });
  await expect.poll(async () => (await video(page)).height).toBeLessThan(0.42 * 810 - 2);
  const v = await video(page);
  expect(v.width / v.height).toBeCloseTo(16 / 9, 1);
  let most = 0;
  const words = await readThrough(page, async (n) => {
    expect(await overflow(page), `page ${n} scrolls`).toBeLessThanOrEqual(0);
    most = Math.max(most, await lines(page));
  });
  expect(words).toBe(1000);
  expect(most).toBeGreaterThanOrEqual(3);
});

test("a lesson under a video splits the same whichever page it opens on, also once the end is reached", async ({ page }) => {
  await openVideo(page, { width: 930, height: 810 });
  await expect.poll(async () => (await video(page)).height).toBeLessThan(0.42 * 810 - 2);
  const count = await pageCount(page);
  await openReader(page, `/read/${created!.id}?page=${count - 1}`);
  await expect(pager(page)).toContainText(`Page ${count - 1} of ${count}`);
  await nextPage(page);
  await expect(page.locator("[data-finish]")).toBeVisible();
  await page.waitForTimeout(500);
  await expect(pager(page)).toContainText(`Page ${count} of ${count}`);
});

test("a video with room to spare keeps its usual size, and the page doesn't scroll", async ({ page }) => {
  await openVideo(page, { width: 930, height: 1100 });
  await expect.poll(async () => Math.round((await video(page)).height)).toBe(Math.round(0.42 * 1100));
  expect(await overflow(page)).toBeLessThanOrEqual(0);
});

test("on a window too short for both, the video stops shrinking at 180 px and pages keep three lines", async ({ page }) => {
  await openVideo(page, { width: 930, height: 500 });
  await expect.poll(async () => Math.round((await video(page)).height)).toBe(180);
  expect(await lines(page)).toBe(3);
});

test("turning through a lesson whose pages scroll never changes how it is split", async ({ page }) => {
  await page.setViewportSize({ width: 930, height: 420 });
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  const count = await pageCount(page);
  let scrolled = 0;
  let still = 0;
  const words = await readThrough(page, async () => {
    if ((await overflow(page)) > 0) scrolled++;
    else still++;
  });
  expect(words).toBe(1000);
  expect(await pageCount(page)).toBe(count);
  expect(scrolled, "pages that scroll").toBeGreaterThan(0);
  expect(still, "pages that don't").toBeGreaterThan(0);
});

test("opening the last word on a page keeps the page, and its popup fits without scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 930, height: 560 });
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  await nextPage(page);
  await expect(pager(page)).toContainText("Page 2 of");
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  const count = await pageCount(page);
  const first = await firstWord(page);
  await wordsShown(page).last().click();
  await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  await expect(pager(page)).toContainText(`Page 2 of ${count}`);
  expect(await firstWord(page)).toBe(first);
});

test("a scrollbar appearing doesn't move the reader's text sideways", async ({ page }) => {
  await page.setViewportSize({ width: 930, height: 1100 });
  created = await createText(page, 40);
  await openReader(page, `/read/${created.id}`);
  expect(await overflow(page)).toBeLessThanOrEqual(0);
  const before = (await article(page).boundingBox())!;
  const grow = () => page.evaluate(() => document.body.append(Object.assign(document.createElement("div"), { style: "height:3000px" })));
  await grow();
  expect(await overflow(page)).toBeGreaterThan(0);
  const after = (await article(page).boundingBox())!;
  expect([after.x, after.width]).toEqual([before.x, before.width]);
});

test("playing across the end of a page turns once and stays", async ({ page }) => {
  await page.setViewportSize({ width: 930, height: 420 });
  created = await createText(page);
  await addSyncedAudio(page, created.id, 900);
  await openReader(page, `/read/${created.id}`);
  const count = await pageCount(page);
  const pages: string[] = [];
  await page.exposeFunction("__pageSeen", (p: string) => pages.push(p));
  await page.evaluate(() => {
    const read = () => document.querySelector('nav[aria-label="Pages"]')?.textContent ?? "";
    let last = read();
    new MutationObserver(() => {
      const now = read();
      if (now !== last) (window as unknown as { __pageSeen: (p: string) => void }).__pageSeen((last = now));
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await wordsShown(page).nth(-3).click();
  await page.getByRole("button", { name: "Play from here" }).click();
  await expect(pager(page)).toContainText(`Page 2 of ${count}`, { timeout: 10_000 });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(pager(page)).toContainText(`Page 2 of ${count}`);
  expect(pages.map((p) => p.match(/Page \d+ of \d+/)?.[0])).toEqual([`Page 2 of ${count}`]);
});

test("laptops keep the video beside the text at its size, and phones keep it full width", async ({ page }) => {
  await openVideo(page, { width: 1280, height: 720 });
  const beside = await video(page);
  expect(beside.x).toBeGreaterThanOrEqual((await article(page).boundingBox())!.x + 100);
  expect(beside.width / beside.height).toBeCloseTo(16 / 9, 1);
  await cleanUp(page, created);

  await openVideo(page, { width: 390, height: 844 });
  const phone = await video(page);
  expect(phone.width).toBeGreaterThanOrEqual((await article(page).boundingBox())!.width - 1);
  expect(phone.width / phone.height).toBeCloseTo(16 / 9, 1);
});
