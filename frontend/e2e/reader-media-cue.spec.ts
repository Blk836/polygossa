import { expect, test, type Page } from "@playwright/test";
import { addSyncedAudio, article, cleanUp, createText, createVideo, openReader, pager, player, setReaderCookie, TALL, type Created } from "./reader-helpers";

test.use({ viewport: TALL });

let created: Created | null = null;

test.beforeEach(async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
});

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const FAKE_YOUTUBE = `
window.__yt = { calls: [], state: -1, time: 0 };
window.YT = { Player: class {
  constructor(el, o) {
    this.o = o;
    el.replaceWith(document.createElement("iframe"));
    setTimeout(() => o.events.onReady({ target: this }));
  }
  set(s) { window.__yt.state = s; this.o.events.onStateChange?.({ data: s, target: this }); }
  playVideo() { window.__yt.calls.push("play"); this.set(1); }
  pauseVideo() { window.__yt.calls.push("pause"); this.set(2); }
  seekTo(s) {
    window.__yt.calls.push("seek:" + Math.round(s * 1000));
    setTimeout(() => { window.__yt.time = s; }, 100);
    if (window.__yt.state !== 1 && window.__yt.state !== 2) this.set(1);
  }
  getCurrentTime() { return window.__yt.time; }
  getDuration() { return 3600; }
  setPlaybackRate() {}
  destroy() {}
} };
window.onYouTubeIframeAPIReady?.();
`;

const fakeYouTube = (page: Page) =>
  page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_YOUTUBE }));
const ytCalls = (page: Page) => page.evaluate(() => (window as unknown as { __yt: { calls: string[] } }).__yt.calls);
const ytState = (page: Page) => page.evaluate(() => (window as unknown as { __yt: { state: number } }).__yt.state);

const seek = (page: Page) => player(page).getByRole("slider", { name: "Seek" });
const seekMs = async (page: Page) => Number(await seek(page).inputValue());
const audioPaused = (page: Page) => page.locator("audio").evaluate((a) => (a as HTMLAudioElement).paused);

async function pageStartMs(page: Page, id: number): Promise<number> {
  const first = Number(await article(page).locator("[data-i]").first().getAttribute("data-i"));
  const detail = await (await page.request.get(`/api/texts/${id}`)).json();
  const timings = ((detail.video ?? detail.audio).timings as { i: number; s: number }[]).filter((t) => t.i >= first);
  timings.sort((a, b) => a.i - b.i);
  return timings[0].s;
}

interface Timing { i: number; s: number; e: number }

async function timingsOf(page: Page, id: number): Promise<Timing[]> {
  const detail = await (await page.request.get(`/api/texts/${id}`)).json();
  return [...((detail.video ?? detail.audio).timings as Timing[])].sort((a, b) => a.i - b.i);
}

async function seekToWord(page: Page, t: Timing) {
  await seek(page).fill(String(t.s + 1));
  await expect(article(page).locator(`[data-i="${t.i}"]`)).toHaveClass(/w-speaking/);
}

async function reopenOnPage(page: Page, id: number, n: number) {
  await openReader(page, `/read/${id}?page=${n}`);
  await expect(pager(page)).toContainText(`Page ${n} of 4`);
  await page.goto("/library");
  await openReader(page, `/read/${id}`);
  await expect(pager(page)).toContainText(`Page ${n} of 4`);
}

test.describe("videos", () => {
  test.beforeEach(async ({ page }) => fakeYouTube(page));

  test("reopening on page 3 cues the slider to page 3 without playing", async ({ page }) => {
    created = await createVideo(page);
    await reopenOnPage(page, created.id, 3);
    const start = await pageStartMs(page, created.id);
    expect(start).toBeGreaterThan(0);
    await expect.poll(() => seekMs(page)).toBe(start);
    expect(await ytCalls(page)).not.toContain("play");
    expect(await ytState(page)).not.toBe(1);
  });

  test("pressing Play continues from page 3, not from 0:00", async ({ page }) => {
    created = await createVideo(page);
    await reopenOnPage(page, created.id, 3);
    const start = await pageStartMs(page, created.id);
    await expect.poll(() => seekMs(page)).toBe(start);
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => ytCalls(page)).toEqual([`seek:${start}`, "play"]);
    await expect(pager(page)).toContainText("Page 3 of 4");
  });

  test("moving the slider on an unstarted video turns to that point's page and stays paused", async ({ page }) => {
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toContainText("60:00");
    const timings = await timingsOf(page, created.id);
    await seekToWord(page, timings[Math.floor(timings.length * 0.6)]);
    await expect(pager(page)).toContainText("Page 3 of 4");
    expect(await ytCalls(page)).not.toContain("play");
    expect(await ytState(page)).not.toBe(1);
  });

  test("moving the slider on a started, paused video turns to that point's page", async ({ page }) => {
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toContainText("60:00");
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await player(page).getByRole("button", { name: "Pause" }).click();
    const timings = await timingsOf(page, created.id);
    await seekToWord(page, timings[Math.floor(timings.length * 0.6)]);
    await expect(pager(page)).toContainText("Page 3 of 4");
    expect(await ytState(page)).toBe(2);
    await page.evaluate(() => {
      const seen: string[] = ((window as unknown as { __pages: string[] }).__pages = []);
      const nav = document.querySelector('nav[aria-label="Pages"]')!;
      new MutationObserver(() => seen.push(nav.textContent ?? "")).observe(nav, { subtree: true, characterData: true, childList: true });
    });
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await page.waitForTimeout(500);
    await expect(pager(page)).toContainText("Page 3 of 4");
    expect(await page.evaluate(() => (window as unknown as { __pages: string[] }).__pages.join("|"))).not.toContain("Page 1 of 4");
  });

  test("turning the page while the video plays jumps the video to the new page and stays", async ({ page }) => {
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toContainText("60:00");
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => ytState(page)).toBe(1);
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    const start = await pageStartMs(page, created.id);
    await expect.poll(() => ytCalls(page)).toContain(`seek:${start}`);
    await page.waitForTimeout(500);
    await expect(pager(page)).toContainText("Page 2 of 4");
    expect(await ytState(page)).toBe(1);
  });

  test("moving the slider past the last word leaves the page alone", async ({ page }) => {
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toContainText("60:00");
    const last = (await timingsOf(page, created.id)).at(-1)!;
    await seek(page).fill(String(last.e + 60_000));
    await page.waitForTimeout(500);
    await expect(pager(page)).toContainText("Page 1 of 4");
  });

  test("after moving the slider on a reopened video, Play starts from the slider, not the page cue", async ({ page }) => {
    created = await createVideo(page);
    await reopenOnPage(page, created.id, 3);
    await expect(player(page)).toContainText("60:00");
    const timings = await timingsOf(page, created.id);
    const target = timings[Math.floor(timings.length * 0.3)];
    await seekToWord(page, target);
    await expect(pager(page)).toContainText("Page 2 of 4");
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => ytCalls(page)).toEqual([`seek:${target.s + 1}`, "play"]);
  });

  test("a video that can't load still reopens on page 3 without errors", async ({ page }) => {
    await page.unroute("https://www.youtube.com/iframe_api");
    await page.route("https://www.youtube.com/iframe_api", (route) => route.abort());
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    created = await createVideo(page);
    await reopenOnPage(page, created.id, 3);
    await expect(page.getByText("The video can't be played here")).toBeVisible();
    await expect(pager(page)).toContainText("Page 3 of 4");
    expect(errors).toEqual([]);
  });
});

test.describe("audio texts", () => {
  async function withAudio(page: Page) {
    created = await createText(page);
    await addSyncedAudio(page, created.id);
    return created.id;
  }

  test("reopening on page 3 cues the slider there, paused, and Play starts from it", async ({ page }) => {
    const id = await withAudio(page);
    await reopenOnPage(page, id, 3);
    const start = await pageStartMs(page, id);
    expect(start).toBeGreaterThan(0);
    await expect.poll(() => seekMs(page)).toBe(start);
    expect(await audioPaused(page)).toBe(true);
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => seekMs(page)).toBeGreaterThan(start);
    await expect(pager(page)).toContainText("Page 3 of 4");
    await player(page).getByRole("button", { name: "Pause" }).click();
  });

  test("moving the slider on paused audio turns to that point's page; within a page it only moves the highlight", async ({ page }) => {
    const id = await withAudio(page);
    await openReader(page, `/read/${id}`);
    await expect(player(page)).toContainText("1:00");
    const timings = await timingsOf(page, id);
    const k = Math.floor(timings.length * 0.6);
    await seekToWord(page, timings[k]);
    await expect(pager(page)).toContainText("Page 3 of 4");
    await seekToWord(page, timings[k + 20]);
    await expect(pager(page)).toContainText("Page 3 of 4");
    await expect(article(page).locator(".w-speaking")).toHaveCount(1);
    expect(await audioPaused(page)).toBe(true);
  });

  test("a ?page=2 link cues the slider to page 2", async ({ page }) => {
    const id = await withAudio(page);
    await openReader(page, `/read/${id}?page=2`);
    await expect(pager(page)).toContainText("Page 2 of 4");
    await expect.poll(() => seekMs(page)).toBe(await pageStartMs(page, id));
  });

  test("page 1 stays at 0:00", async ({ page }) => {
    const id = await withAudio(page);
    await openReader(page, `/read/${id}`);
    await expect(player(page)).toContainText("1:00");
    expect(await seekMs(page)).toBe(0);
    await expect(player(page)).toContainText("0:00");
  });

  test("turning the page before playing moves the cue to the new page", async ({ page }) => {
    const id = await withAudio(page);
    await openReader(page, `/read/${id}`);
    await expect(player(page)).toContainText("1:00");
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    await expect.poll(() => seekMs(page)).toBe(await pageStartMs(page, id));
  });

  test("after moving the slider, turning the page leaves the position alone", async ({ page }) => {
    const id = await withAudio(page);
    await openReader(page, `/read/${id}`);
    await expect(player(page)).toContainText("1:00");
    await seek(page).fill("5000");
    await expect.poll(() => seekMs(page)).toBe(5000);
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    await page.waitForTimeout(500);
    expect(await seekMs(page)).toBe(5000);
  });

  test("after playing, turning the page leaves the position alone", async ({ page }) => {
    const id = await withAudio(page);
    await openReader(page, `/read/${id}`);
    await expect(player(page)).toContainText("1:00");
    await player(page).getByRole("button", { name: "Play", exact: true }).click();
    await expect.poll(() => seekMs(page)).toBeGreaterThan(0);
    await player(page).getByRole("button", { name: "Pause" }).click();
    await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
    const paused = await seekMs(page);
    await pager(page).getByRole("button", { name: "Next page" }).click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    await page.waitForTimeout(500);
    expect(await seekMs(page)).toBe(paused);
  });
});
