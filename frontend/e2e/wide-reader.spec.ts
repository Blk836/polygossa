import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  article,
  bottomPager,
  cleanUp,
  createText,
  createVideo,
  openReader,
  pager,
  player,
  setReaderCookie,
  TALL,
  type Created,
} from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const DESKTOP = { width: 1440, height: 900 };
const LAPTOP = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };

const FAKE_YOUTUBE = `
window.__players = 0;
window.YT = { Player: class {
  constructor(el, o) {
    window.__players++;
    const frame = document.createElement("iframe");
    frame.style.width = "100%"; frame.style.height = "100%"; frame.style.border = "0";
    el.replaceWith(frame);
    window.__frame = frame;
    setTimeout(() => o.events.onReady({ target: this }));
  }
  playVideo() {} pauseVideo() {} seekTo() {}
  getCurrentTime() { return 0; }
  getDuration() { return 600; }
  setPlaybackRate() {} destroy() {}
} };
window.onYouTubeIframeAPIReady?.();
`;
const fakeYouTube = (page: Page) =>
  page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_YOUTUBE }));

async function box(locator: Locator) {
  const b = await locator.boundingBox();
  if (!b) throw new Error("element is not visible");
  return b;
}

const settingsButton = (page: Page) => page.getByRole("button", { name: "Reader settings" });
const settingsMenu = (page: Page) => page.getByRole("dialog", { name: "Reader settings" });
const textWidth = (page: Page, name: string) => settingsMenu(page).getByRole("radio", { name, exact: true });
const pageCount = async (page: Page) => Number((await pager(page).textContent())!.match(/of (\d+)/)![1]);
const arrow = (page: Page, which: "previous" | "next") => page.locator(`[data-page-arrow="${which}"]`);
const dock = (page: Page) => page.getByTestId("video-dock");
const noSidewaysScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test.describe("a wider canvas", () => {
  test.beforeEach(async ({ page }) => setReaderCookie(page, "known%3D0"));

  test("on a laptop the text column is at least 960 px wide and centred", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const text = await box(article(page));
    expect(text.width).toBeGreaterThanOrEqual(960);
    expect(Math.abs(text.x + text.width / 2 - DESKTOP.width / 2)).toBeLessThanOrEqual(12);
  });

  test("text width is a setting: Standard, Wide (the default) or Full, remembered for the next lesson", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    await settingsButton(page).click();
    await expect(textWidth(page, "Wide")).toBeChecked();
    const wide = (await box(article(page))).width;

    await textWidth(page, "Standard").click();
    await expect.poll(async () => (await box(article(page))).width).toBeLessThanOrEqual(768);
    await textWidth(page, "Full").click();
    await expect.poll(async () => (await box(article(page))).width).toBeGreaterThan(wide);
    expect((await page.context().cookies()).find((c) => c.name === "lector_reader")?.value).toContain("width");

    await page.setViewportSize(DESKTOP);
    const html = await (await page.request.get(`/read/${created.id}`)).text();
    expect(html).toContain('data-text-width="full"');
    await openReader(page, `/read/${created.id}`);
    expect((await box(article(page))).width).toBeGreaterThan(wide);
  });

  test("wider lines mean fewer pages", async ({ page }) => {
    await page.setViewportSize(LAPTOP);
    created = await createText(page);
    await setReaderCookie(page, "known%3D0%26width%3Dstandard");
    await openReader(page, `/read/${created.id}`);
    const standard = await pageCount(page);
    await setReaderCookie(page, "known%3D0");
    await openReader(page, `/read/${created.id}`);
    expect(await pageCount(page)).toBeLessThan(standard);
  });

  test("on a phone every text width fills the screen, with nothing scrolling sideways", async ({ page }) => {
    await page.setViewportSize(PHONE);
    created = await createText(page);
    const widths: number[] = [];
    for (const width of ["standard", "wide", "full"]) {
      await setReaderCookie(page, `known%3D0%26width%3D${width}`);
      await openReader(page, `/read/${created.id}`);
      widths.push((await box(article(page))).width);
      expect(await noSidewaysScroll(page), width).toBe(true);
    }
    expect(widths[0]).toBeGreaterThanOrEqual(PHONE.width - 40);
    expect(new Set(widths).size).toBe(1);
  });
});

test.describe("a slim header", () => {
  test("the text starts high on the screen, under the way back, the title with its tools, and one line of details", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    expect((await box(article(page))).y).toBeLessThanOrEqual(230);
    await expect(page.getByRole("link", { name: "← Library" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(`Reader check ${created.prefix}`);
    for (const name of ["Reader settings", "Keyboard shortcuts", "Add audio"]) await expect(page.getByRole("button", { name }), name).toBeVisible();
    const known = page.getByTestId("reader-known");
    await expect(known).toContainText("You know 0% of the words");
    await expect(known).toContainText(/new · 0 learning/);
    const title = await box(page.getByRole("heading", { level: 1 }));
    expect(Math.abs((await box(settingsButton(page))).y + 16 - (title.y + title.height / 2))).toBeLessThanOrEqual(12);
  });
});

test.describe("page arrows beside the text", () => {
  test.beforeEach(async ({ page }) => setReaderCookie(page, "known%3D0"));

  test("the right arrow turns to the next page and the left one back; none past either end", async ({ page }) => {
    await page.setViewportSize(TALL);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    await expect(pager(page)).toContainText("Page 1 of 4");
    await expect(arrow(page, "previous")).toHaveCount(0);
    const next = arrow(page, "next");
    await expect(next).toBeVisible();
    const text = await box(article(page));
    const right = await box(next);
    expect(right.x).toBeGreaterThanOrEqual(text.x + text.width);
    expect(right.height).toBeGreaterThanOrEqual(text.height / 2);

    await next.click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    await arrow(page, "previous").click();
    await expect(pager(page)).toContainText("Page 1 of 4");

    await openReader(page, `/read/${created.id}?page=4`);
    await expect(pager(page)).toContainText("Page 4 of 4");
    await expect(arrow(page, "next")).toHaveCount(0);
    await expect(arrow(page, "previous")).toBeVisible();
  });

  test("the arrows are for the mouse: out of the tab order and hidden from screen readers; Next is the pager's main button", async ({ page }) => {
    await page.setViewportSize(LAPTOP);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    await expect(arrow(page, "next")).toHaveAttribute("tabindex", "-1");
    await expect(arrow(page, "next")).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("button", { name: "Next page" })).toHaveCount(1);
    await expect(bottomPager(page).getByRole("button", { name: "Next page" })).toHaveAttribute("data-primary", "true");
  });

  test("turning the page with an arrow marks its new words known, like Next", async ({ page }) => {
    await setReaderCookie(page, "");
    await page.setViewportSize(LAPTOP);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const saved = page.waitForResponse((r) => r.url().includes("/mark-known") && r.request().method() === "POST");
    await arrow(page, "next").click();
    await saved;
    await expect(pager(page)).toContainText("Page 2 of");
    const found = await (await page.request.get(`/api/vocabulary?language=${created.language}&q=${created.prefix}&size=5`)).json();
    expect(found.items.length).toBeGreaterThan(0);
  });

  test("phones have no side arrows", async ({ page }) => {
    await page.setViewportSize(PHONE);
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    await expect(pager(page)).toContainText("Page 1 of");
    await expect(arrow(page, "next")).toBeHidden();
  });
});

test.describe("video: beside the text, or a mini player", () => {
  test.beforeEach(async ({ page }) => {
    await fakeYouTube(page);
    await setReaderCookie(page, "known%3D0");
  });

  test("on a laptop the video is beside the text, and the text is still at least 760 px wide", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    const text = await box(article(page));
    expect((await box(dock(page))).x).toBeGreaterThanOrEqual(text.x + text.width);
    expect(text.width).toBeGreaterThanOrEqual(760);
  });

  test("the mini player floats in the corner above the player bar, the text widens, and the video is not reloaded", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __players: number }).__players)).toBe(1);
    const beside = (await box(article(page))).width;

    await player(page).getByRole("button", { name: "Mini player" }).click();
    const mini = await box(dock(page));
    const bar = await box(player(page));
    expect(mini.x + mini.width).toBeGreaterThanOrEqual(DESKTOP.width - 40);
    expect(mini.y + mini.height).toBeLessThanOrEqual(bar.y);
    expect(mini.height).toBeGreaterThanOrEqual(200);
    expect(mini.width).toBeGreaterThanOrEqual(200);
    await expect.poll(async () => (await box(article(page))).width).toBeGreaterThanOrEqual(960);
    expect((await box(article(page))).width).toBeGreaterThan(beside);
    expect(await page.evaluate(() => {
      const w = window as unknown as { __players: number; __frame: HTMLIFrameElement };
      return { players: w.__players, same: w.__frame.isConnected };
    })).toEqual({ players: 1, same: true });

    await player(page).getByRole("button", { name: "Video beside text" }).click();
    const text = await box(article(page));
    expect((await box(dock(page))).x).toBeGreaterThanOrEqual(text.x + text.width);
  });

  test("the mini player is 200 × 200 px, YouTube's minimum, and the video player fills it", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await player(page).getByRole("button", { name: "Mini player" }).click();
    await expect.poll(async () => (await box(dock(page))).width).toBe(200);
    const mini = await box(dock(page));
    expect(mini.height).toBe(200);
    const frame = await box(dock(page).locator("iframe"));
    expect({ width: frame.width, height: frame.height }).toEqual({ width: 200, height: 200 });
    expect(await page.evaluate(() => (window as unknown as { __players: number }).__players)).toBe(1);
  });

  test("the mini player is remembered, from the first paint of the next load", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await player(page).getByRole("button", { name: "Mini player" }).click();
    const html = await (await page.request.get(`/read/${created.id}`)).text();
    expect(html).toContain('data-video-layout="mini"');
    await openReader(page, `/read/${created.id}`);
    await expect(player(page).getByRole("button", { name: "Video beside text" })).toBeVisible();
  });

  test("where the mini player overlaps the text, every page ends above it without scrolling", async ({ page }) => {
    await setReaderCookie(page, "known%3D0%26video%3Dmini");
    await page.setViewportSize(DESKTOP);
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    const mini = await box(dock(page));
    const text = await box(article(page));
    expect(mini.x).toBeLessThan(text.x + text.width);
    const count = await pageCount(page);
    for (let n = 1; n <= count; n++) {
      await expect(pager(page)).toContainText(`Page ${n} of ${count}`);
      const last = await box(article(page).locator("[data-i]").last());
      expect(last.y + last.height, `page ${n}`).toBeLessThanOrEqual(mini.y);
      expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight), `page ${n} scrolls`).toBeLessThanOrEqual(0);
      if (n < count) await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    }
  });

  test("where the mini player sits in the margin, pages use the full height", async ({ page }) => {
    await setReaderCookie(page, "known%3D0%26video%3Dmini%26width%3Dstandard");
    await page.setViewportSize({ width: 1920, height: 900 });
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    const mini = await box(dock(page));
    const text = await box(article(page));
    expect(mini.x).toBeGreaterThanOrEqual(text.x + text.width);
    const last = await box(article(page).locator("[data-i]").last());
    expect(last.y + last.height).toBeGreaterThan(mini.y);
  });

  test("phones keep the video above the text, whatever was chosen, with no Mini player button", async ({ page }) => {
    await setReaderCookie(page, "known%3D0%26video%3Dmini");
    await page.setViewportSize(PHONE);
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    const video = await box(dock(page));
    expect(video.y + video.height).toBeLessThanOrEqual((await box(article(page))).y);
    await expect(player(page).getByRole("button", { name: /Mini player|Video beside text/ })).toBeHidden();
    expect(await noSidewaysScroll(page)).toBe(true);
  });
});
