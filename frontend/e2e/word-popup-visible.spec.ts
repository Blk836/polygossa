import { expect, test, type Locator, type Page } from "@playwright/test";
import { article, cleanUp, createText, createVideo, fakeYouTube, openReader, player, setReaderCookie, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const LAPTOP = { width: 1280, height: 720 };
const DESKTOP = { width: 1440, height: 900 };

const popup = (page: Page) => page.locator("[data-word-popup]");
const words = (page: Page) => article(page).locator("[data-i]");

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element is not visible");
  return b;
}

async function open(page: Page, word: Locator) {
  await word.click();
  await expect(popup(page).getByRole("button", { name: "Close", exact: true })).toBeVisible();
  await expect(popup(page).getByRole("status", { name: "Loading" })).toHaveCount(0);
}

async function expectInWindow(page: Page, bottom?: number) {
  const b = await box(popup(page));
  const size = page.viewportSize()!;
  expect(b.y, "popup starts above the window").toBeGreaterThanOrEqual(0);
  expect(b.y + b.height, "popup runs below the visible area").toBeLessThanOrEqual((bottom ?? size.height) + 0.5);
  expect(b.x).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(size.width);
  return b;
}

const overlaps = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe("on a laptop", () => {
  test.use({ viewport: LAPTOP });
  test.beforeEach(async ({ page }) => setReaderCookie(page, "known%3D0"));

  test("a word at the top of the page still opens its card 8 px below it", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const word = words(page).first();
    await open(page, word);
    const w = await box(word);
    const p = await expectInWindow(page);
    expect(p.y).toBeCloseTo(w.y + w.height + 8, 0);
  });

  test("the last word on the page opens its card above it, all of it in the window", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const word = words(page).last();
    await open(page, word);
    const w = await box(word);
    const p = await expectInWindow(page);
    expect(p.y + p.height).toBeCloseTo(w.y - 8, 0);
  });

  test("the card moves to stay in the window when its content grows after opening", async ({ page }) => {
    let release = () => {};
    const released = new Promise<void>((done) => (release = done));
    await page.route("**/api/dictionary?*", async (route) => {
      await released;
      const also = Array.from({ length: 24 }, (_, k) => `meaning number ${k + 1}`);
      await route.fulfill({
        json: { term: "x", language: created!.language, meanings: ["a long first meaning that needs a couple of lines", ...also], meaningLanguage: "en", source: "machine" },
      });
    });
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const word = words(page).last();
    await word.click();
    await expect(popup(page).getByRole("status", { name: "Loading" })).toBeVisible();
    const before = await box(popup(page));
    release();
    await expect(popup(page).getByTestId("meaning-also")).toBeVisible();
    await expect.poll(async () => (await box(popup(page))).height).toBeGreaterThan(before.height);
    const w = await box(word);
    const p = await expectInWindow(page);
    expect(p.y + p.height).toBeCloseTo(w.y - 8, 0);
  });

  test("with the player bar showing, the card ends above it", async ({ page }) => {
    await fakeYouTube(page);
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toBeVisible();
    const bar = await box(page.locator("[data-bottom-bar]"));
    await open(page, words(page).last());
    await expectInWindow(page, bar.y);
  });
});

test("where the mini player covers the text, the card keeps clear of it", async ({ page }) => {
  await fakeYouTube(page);
  await setReaderCookie(page, "known%3D0%26video%3Dmini");
  await page.setViewportSize(DESKTOP);
  created = await createVideo(page);
  await openReader(page, `/read/${created.id}`);
  const mini = await box(page.getByTestId("video-dock"));
  const text = await box(article(page));
  expect(mini.x).toBeLessThan(text.x + text.width);
  const last = words(page).last();
  await last.evaluate((el) => {
    const right = el.closest("article")!.getBoundingClientRect().right;
    el.style.display = "inline-block";
    el.style.marginLeft = `${right - el.getBoundingClientRect().right}px`;
  });
  await open(page, last);
  expect(overlaps(await expectInWindow(page), mini), "the card covers the mini player").toBe(false);
});

test("on a short window the card is pushed up to fit and scrolls inside itself", async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
  await page.setViewportSize({ width: 1280, height: 300 });
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  const word = words(page).first();
  await word.scrollIntoViewIfNeeded();
  await open(page, word);
  const p = await expectInWindow(page);
  expect(p.y + p.height).toBeCloseTo(300, 0);
  const scrolls = await popup(page).locator(".overflow-y-auto").evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrolls).toBe(true);
});

test("phones keep the card as a bottom sheet", async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
  await page.setViewportSize({ width: 390, height: 844 });
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  const word = words(page).last();
  await word.scrollIntoViewIfNeeded();
  await open(page, word);
  const p = await box(popup(page));
  expect([p.x, p.width, p.y + p.height]).toEqual([0, 390, 844]);
});
