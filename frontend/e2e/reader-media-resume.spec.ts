import { expect, test, type Page } from "@playwright/test";
import { addSyncedAudio, cleanUp, createText, createVideo, openReader, pager, player, TALL, type Created } from "./reader-helpers";

// Pressing Play on a lesson reopened on a later page: the seek bar shows where that page starts, and must keep showing
// it until playback moves on, never 0:00. Like YouTube's real player, the stand-in here takes a moment to start
// (buffering) and reports a seek's new time a moment late.

test.use({ viewport: TALL }); // four pages of 250 words

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const SLOW_YOUTUBE = `
window.__yt = { calls: [], state: -1, time: 0 };
window.YT = { Player: class {
  constructor(el, o) {
    this.o = o;
    el.replaceWith(document.createElement("iframe"));
    setTimeout(() => o.events.onReady({ target: this }));
    setInterval(() => { if (window.__yt.state === 1) window.__yt.time += 0.25; }, 250);
    window.__ytOwnPlay = () => this.start(); // YouTube's own play button, inside the iframe
  }
  set(s) { window.__yt.state = s; this.o.events.onStateChange?.({ data: s, target: this }); }
  start() {
    clearTimeout(this.starting);
    setTimeout(() => this.set(3), 50);
    this.starting = setTimeout(() => this.set(1), 800);
  }
  playVideo() { window.__yt.calls.push("play"); if (window.__yt.state !== 1) this.start(); }
  pauseVideo() { window.__yt.calls.push("pause"); clearTimeout(this.starting); this.set(2); }
  seekTo(s) { window.__yt.calls.push("seek:" + Math.round(s * 1000)); setTimeout(() => { window.__yt.time = s; }, 100); }
  getCurrentTime() { return window.__yt.time; }
  getDuration() { return 3600; }
  setPlaybackRate() {}
  destroy() {}
} };
window.onYouTubeIframeAPIReady?.();
`;

type Win = { __yt: { calls: string[] }; __bar: number[]; __ytOwnPlay: () => void };

const seekBar = (page: Page) => player(page).getByRole("slider", { name: "Seek" });
const seekMs = async (page: Page) => Number(await seekBar(page).inputValue());
const playButton = (page: Page) => player(page).getByRole("button", { name: "Play", exact: true });

/** Reads page `n` (so the browser remembers it), leaves, and opens the lesson again without a page in the URL. */
async function reopenOnPage(page: Page, id: number, n: number) {
  await openReader(page, `/read/${id}?page=${n}`);
  await expect(pager(page)).toContainText(`Page ${n} of 4`);
  await page.goto("/library");
  await openReader(page, `/read/${id}`);
  await expect(pager(page)).toContainText(`Page ${n} of 4`);
}

/** When the first word on the page shown is spoken, from the lesson's own timings. */
async function pageStartMs(page: Page, id: number): Promise<number> {
  const first = Number(await page.locator("article [data-i]").first().getAttribute("data-i"));
  const detail = await (await page.request.get(`/api/texts/${id}`)).json();
  const timings = ((detail.video ?? detail.audio).timings as { i: number; s: number }[]).filter((t) => t.i >= first);
  return Math.min(...timings.map((t) => t.s));
}

/** Records the seek bar's value on every frame from now on. */
async function recordBar(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as Win;
    w.__bar = [];
    const bar = document.querySelector<HTMLInputElement>("input[aria-label=Seek]")!;
    const frame = () => {
      w.__bar.push(Number(bar.value));
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
}

const recorded = (page: Page) => page.evaluate(() => (window as unknown as Win).__bar);

/** Opens a video on page 3 with the bar cued there; returns where page 3 starts. */
async function cuedVideo(page: Page): Promise<number> {
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: SLOW_YOUTUBE }));
  created = await createVideo(page);
  await reopenOnPage(page, created.id, 3);
  await expect(player(page)).toContainText("60:00");
  const start = await pageStartMs(page, created.id);
  expect(start).toBeGreaterThan(0);
  await expect.poll(() => seekMs(page)).toBe(start);
  await recordBar(page);
  return start;
}

test.describe("videos", () => {
  test("pressing Play keeps the bar at the page's start while the video starts, then moves on", async ({ page }) => {
    const start = await cuedVideo(page);
    await playButton(page).click();
    await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
    await expect.poll(() => seekMs(page)).toBeGreaterThan(start);
    expect((await recorded(page)).filter((v) => v < start)).toEqual([]);
  });

  test("starting from YouTube's own play button never shows 0:00", async ({ page }) => {
    const start = await cuedVideo(page);
    await page.evaluate(() => (window as unknown as Win).__ytOwnPlay());
    await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
    await expect.poll(() => seekMs(page)).toBeGreaterThan(start);
    expect((await recorded(page)).filter((v) => v < start)).toEqual([]);
    expect((await page.evaluate(() => (window as unknown as Win).__yt.calls))[0]).toBe(`seek:${start}`);
  });

  test("pressing Play twice while the video is still starting keeps the bar at the page's start", async ({ page }) => {
    // While YouTube starts, the button still reads Play (there is no Pause to press yet), so a second press is the
    // impatient listener's case.
    const start = await cuedVideo(page);
    await playButton(page).click();
    await page.waitForTimeout(200);
    await playButton(page).click();
    await page.waitForTimeout(300);
    expect(await seekMs(page)).toBe(start);
    await expect.poll(() => seekMs(page)).toBeGreaterThan(start);
    expect((await recorded(page)).filter((v) => v < start)).toEqual([]);
  });

  test("a video opened on page 1 still starts from 0:00", async ({ page }) => {
    await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: SLOW_YOUTUBE }));
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toContainText("60:00");
    expect(await seekMs(page)).toBe(0);
    await playButton(page).click();
    await expect.poll(() => seekMs(page)).toBeGreaterThan(0);
    await expect(pager(page)).toContainText("Page 1 of 4");
  });
});

test("an audio lesson reopened on page 3 never shows 0:00 when Play is pressed", async ({ page }) => {
  created = await createText(page);
  await addSyncedAudio(page, created.id);
  await reopenOnPage(page, created.id, 3);
  await expect(player(page)).toContainText("1:00"); // metadata loaded
  const start = await pageStartMs(page, created.id);
  await expect.poll(() => seekMs(page)).toBe(start);
  await recordBar(page);
  await playButton(page).click();
  await expect.poll(() => seekMs(page)).toBeGreaterThan(start);
  await player(page).getByRole("button", { name: "Pause" }).click();
  expect((await recorded(page)).filter((v) => v < start)).toEqual([]);
});
