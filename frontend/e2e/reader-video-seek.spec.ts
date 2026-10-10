import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createVideo, openReader, player, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const STALE_YOUTUBE = `
window.__yt = { calls: [], state: -1, time: 0, confirm: true };
window.YT = { Player: class {
  constructor(el, o) {
    this.o = o;
    el.replaceWith(document.createElement("iframe"));
    setTimeout(() => o.events.onReady({ target: this }));
    setInterval(() => { if (window.__yt.state === 1) window.__yt.time += 0.25; }, 250);
    window.__ytBuffer = () => this.set(3);
  }
  set(s) { window.__yt.state = s; this.o.events.onStateChange?.({ data: s, target: this }); }
  playVideo() { window.__yt.calls.push("play"); this.set(1); }
  pauseVideo() { window.__yt.calls.push("pause"); this.set(2); }
  seekTo(s) {
    window.__yt.calls.push(Math.round(s * 1000));
    if (window.__yt.state !== 1 && window.__yt.state !== 3) return void (window.__yt.time = s);
    const n = (this.seeks = (this.seeks ?? 0) + 1); // a later seek supersedes this one
    setTimeout(() => n === this.seeks && this.set(3), 100);
    setTimeout(() => { if (n !== this.seeks) return; if (window.__yt.confirm) window.__yt.time = s; this.set(1); }, 500);
  }
  getCurrentTime() { return window.__yt.time; }
  getDuration() { return 3600; }
  setPlaybackRate() {}
  destroy() {}
} };
window.onYouTubeIframeAPIReady?.();
`;

interface Sample { v: number; label: string }
type Win = { __yt: { calls: (number | string)[]; confirm: boolean }; __samples: Sample[]; __inputs: number[]; __pressed: boolean; __ytBuffer: () => void };

const seekBar = (page: Page) => player(page).getByRole("slider", { name: "Seek" });
const seeks = async (page: Page) => (await page.evaluate(() => (window as unknown as Win).__yt.calls)).filter((c) => typeof c === "number") as number[];

async function playVideo(page: Page) {
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: STALE_YOUTUBE }));
  created = await createVideo(page);
  await openReader(page, `/read/${created.id}`);
  await expect(player(page)).toContainText("60:00");
  await player(page).getByRole("button", { name: "Play", exact: true }).click();
  await expect.poll(async () => Number(await seekBar(page).inputValue())).toBeGreaterThan(0);
  await page.evaluate(() => {
    const w = window as unknown as Win;
    w.__samples = [];
    w.__inputs = [];
    const bar = document.querySelector<HTMLInputElement>("input[aria-label=Seek]")!;
    const button = document.querySelector('[aria-label="Player"] button[title^="Play / pause"]')!;
    const sample = () => {
      w.__samples.push({ v: Number(bar.value), label: button.getAttribute("aria-label")! });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
    bar.addEventListener("input", () => {
      if (w.__pressed) w.__samples.length = 0;
      w.__pressed = false;
      w.__inputs.push(Number(bar.value));
    });
  });
}

async function pressSeekBar(page: Page, fraction: number, holdMs: number): Promise<number> {
  const box = (await seekBar(page).boundingBox())!;
  await page.evaluate(() => ((window as unknown as Win).__pressed = true));
  await page.mouse.move(box.x + box.width * fraction, box.y + box.height / 2);
  await page.mouse.down();
  const target = await page.evaluate(() => (window as unknown as Win).__inputs.at(-1)!);
  await page.waitForTimeout(holdMs);
  await page.mouse.up();
  return target;
}

const samples = (page: Page) => page.evaluate(() => (window as unknown as Win).__samples);
const near = (ms: number, target: number) => Math.abs(ms - target) <= 3000;

test("a click held past the player's stale time report still jumps there", async ({ page }) => {
  await playVideo(page);
  const target = await pressSeekBar(page, 0.5, 300);
  await page.waitForTimeout(800);
  expect(target).toBeGreaterThan(1_000_000);
  expect((await samples(page)).filter((s) => !near(s.v, target))).toEqual([]);
  expect((await seeks(page)).at(-1)).toBe(target);
  expect(near(Number(await seekBar(page).inputValue()), target)).toBe(true);
});

test("the seek bar never shows the old position after seeking backwards", async ({ page }) => {
  await playVideo(page);
  const ahead = await pressSeekBar(page, 0.6, 50);
  await expect.poll(async () => near(Number(await seekBar(page).inputValue()), ahead + 1000)).toBe(true);
  const back = await pressSeekBar(page, 0.2, 50);
  await page.waitForTimeout(800);
  expect((await samples(page)).filter((s) => !near(s.v, back))).toEqual([]);
  expect((await seeks(page)).at(-1)).toBe(back);
});

test("buffering after a seek keeps the Pause button", async ({ page }) => {
  await playVideo(page);
  await pressSeekBar(page, 0.5, 50);
  await page.waitForTimeout(800);
  const labels = new Set((await samples(page)).map((s) => s.label));
  expect([...labels]).toEqual(["Pause"]);
});

test("a seek the player never confirms gives way to the reported time", async ({ page }) => {
  await playVideo(page);
  await page.evaluate(() => ((window as unknown as Win).__yt.confirm = false));
  const target = await pressSeekBar(page, 0.5, 50);
  await page.waitForTimeout(1000);
  expect(near(Number(await seekBar(page).inputValue()), target)).toBe(true);
  await expect.poll(async () => Number(await seekBar(page).inputValue()), { timeout: 4000 }).toBeLessThan(60_000);
});

test("seeking twice quickly ends at the second target", async ({ page }) => {
  await playVideo(page);
  await pressSeekBar(page, 0.3, 50);
  const second = await pressSeekBar(page, 0.7, 50);
  await page.waitForTimeout(900);
  expect((await seeks(page)).at(-1)).toBe(second);
  expect((await samples(page)).slice(-1)[0].v).toBeGreaterThanOrEqual(second);
  expect(near(Number(await seekBar(page).inputValue()), second)).toBe(true);
});

test("buffering mid-playback keeps the Pause button and stops the highlight", async ({ page }) => {
  await playVideo(page);
  await page.evaluate(() => (window as unknown as Win).__ytBuffer());
  await page.waitForTimeout(100);
  const spoken = await article(page).locator(".w-speaking").getAttribute("data-i");
  await page.waitForTimeout(1200);
  await expect(article(page).locator(".w-speaking")).toHaveAttribute("data-i", spoken!);
  await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("Pause still pauses", async ({ page }) => {
  await playVideo(page);
  await player(page).getByRole("button", { name: "Pause", exact: true }).click();
  await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
  const at = await seekBar(page).inputValue();
  await page.waitForTimeout(600);
  expect(await seekBar(page).inputValue()).toBe(at);
});

test("a looped sentence jumps back to its start once per pass", async ({ page }) => {
  await playVideo(page);
  await player(page).getByRole("button", { name: "Loop sentence" }).click();
  const before = (await seeks(page)).length;
  await page.waitForTimeout(4500);
  const restarts = (await seeks(page)).slice(before);
  expect(restarts.length).toBeGreaterThanOrEqual(1);
  expect(restarts.length).toBeLessThanOrEqual(2);
  expect(Number(await seekBar(page).inputValue())).toBeLessThan(3500);
});
