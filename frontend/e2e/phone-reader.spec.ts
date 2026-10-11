import { expect, test, type Page } from "@playwright/test";
import { addSyncedAudio, article, bottomPager, cleanUp, createText, createVideo, openReader, player, setReaderCookie, type Created } from "./reader-helpers";

const PHONE = { width: 390, height: 844 };
const LAPTOP = { width: 1280, height: 720 };

const RECORDING_YOUTUBE = `
window.__calls = [];
window.YT = { Player: class {
  constructor(el, o) {
    this.o = o;
    const frame = document.createElement("iframe");
    frame.style.width = "100%"; frame.style.height = "100%"; frame.style.border = "0";
    el.replaceWith(frame);
    this.frame = frame;
    setTimeout(() => o.events.onReady({ target: this }));
  }
  shown() { return this.frame.getBoundingClientRect().width > 0; }
  playVideo() { window.__calls.push(["play", this.shown()]); this.o.events.onStateChange({ target: this, data: 1 }); }
  pauseVideo() { window.__calls.push(["pause", this.shown()]); this.o.events.onStateChange({ target: this, data: 2 }); }
  seekTo() {}
  getCurrentTime() { return 0; }
  getDuration() { return 600; }
  setPlaybackRate() {} destroy() {}
} };
window.onYouTubeIframeAPIReady?.();
`;

let created: Created[] = [];

test.beforeEach(async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: RECORDING_YOUTUBE }));
});

test.afterEach(async ({ page }) => {
  for (const c of created) await cleanUp(page, c);
  created = [];
});

async function openVideo(page: Page, viewport = PHONE) {
  await page.setViewportSize(viewport);
  const video = await createVideo(page);
  created.push(video);
  await openReader(page, `/read/${video.id}`);
  await expect(player(page)).toBeVisible();
  await expect(frame(page)).toBeVisible();
  return video;
}

const frame = (page: Page) => page.getByTestId("video-dock").locator("iframe");
const play = (page: Page) => player(page).getByRole("button", { name: "Play", exact: true });
const more = (page: Page) => player(page).getByRole("button", { name: "More player controls" });
const tuck = (page: Page) => page.getByRole("button", { name: "Tuck video away" });
const showVideo = (page: Page) => page.getByRole("button", { name: "Show video" });
const calls = (page: Page) => page.evaluate(() => (window as unknown as { __calls: [string, boolean][] }).__calls);
const wordsShown = (page: Page) => article(page).locator("[data-i]").count();

async function expectCentred(page: Page) {
  const box = (await play(page).boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - PHONE.width / 2)).toBeLessThanOrEqual(2);
}

async function swipe(page: Page, dx: number) {
  const handle = (await page.getByTestId("video-handle").boundingBox())!;
  const x = handle.x + handle.width / 2;
  const y = handle.y + handle.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let k = 1; k <= 6; k++) await page.mouse.move(x + (dx * k) / 6, y);
  await page.mouse.up();
}

test("the player bar is one row under a full-width seek bar, with Play in the middle", async ({ page }) => {
  await openVideo(page);
  await expectCentred(page);
  const bar = (await player(page).boundingBox())!;
  expect(bar.height).toBeLessThanOrEqual(80);
  const seek = (await player(page).getByRole("slider", { name: "Seek" }).boundingBox())!;
  expect(seek.width).toBeGreaterThanOrEqual(PHONE.width - 32);
  const playBox = (await play(page).boundingBox())!;
  const prev = (await player(page).getByRole("button", { name: "Previous sentence" }).boundingBox())!;
  const next = (await player(page).getByRole("button", { name: "Next sentence" }).boundingBox())!;
  expect(prev.x + prev.width).toBeLessThanOrEqual(playBox.x);
  expect(next.x).toBeGreaterThanOrEqual(playBox.x + playBox.width);
  for (const b of [prev, next, seek]) expect(b.y).toBeLessThan(bar.y + bar.height);
  expect(Math.abs(prev.y + prev.height / 2 - (playBox.y + playBox.height / 2))).toBeLessThanOrEqual(2);
});

test("replay, loop and speed are in the More menu, which Escape and a tap outside close", async ({ page }) => {
  await openVideo(page);
  await expect(page.getByRole("button", { name: "Replay sentence" })).toBeHidden();
  await expect(page.getByRole("button", { name: "Loop sentence" })).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Speed" })).toBeHidden();
  await more(page).click();
  await expect(more(page)).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("button", { name: "Replay sentence" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Loop sentence" })).toBeVisible();
  await page.getByRole("combobox", { name: "Speed" }).selectOption("1.25");
  await expect(page.getByRole("combobox", { name: "Speed" })).toHaveValue("1.25");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("combobox", { name: "Speed" })).toBeHidden();
  await more(page).click();
  await expect(page.getByRole("combobox", { name: "Speed" })).toHaveValue("1.25");
  await page.locator("h1").first().click();
  await expect(page.getByRole("combobox", { name: "Speed" })).toBeHidden();
});

test("an audio lesson opens with the same bar, with Close player in the menu", async ({ page }) => {
  await page.setViewportSize(PHONE);
  const text = await createText(page, 200);
  created.push(text);
  await addSyncedAudio(page, text.id);
  await openReader(page, `/read/${text.id}`);
  await expect(player(page)).toBeVisible();
  await expectCentred(page);
  await expect(page.getByRole("button", { name: "Close player" })).toBeHidden();
  await more(page).click();
  await page.getByRole("button", { name: "Close player" }).click();
  await expect(player(page)).toBeHidden();
});

test("wider screens keep every control in the bar", async ({ page }) => {
  await openVideo(page, LAPTOP);
  for (const name of ["Play", "Previous sentence", "Next sentence", "Replay sentence", "Loop sentence"]) {
    await expect(player(page).getByRole("button", { name, exact: true })).toBeVisible();
  }
  await expect(player(page).getByRole("slider", { name: "Seek" })).toBeVisible();
  await expect(player(page).getByRole("combobox", { name: "Speed" })).toBeVisible();
  await expect(more(page)).toHaveCount(0);
});

test("the video stays full width after Play and a page turn until the user changes it", async ({ page }) => {
  await openVideo(page);
  await play(page).click();
  await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  await player(page).getByRole("button", { name: "Pause" }).click();
  await bottomPager(page).getByRole("button", { name: "Next page" }).click();
  await expect(frame(page)).toBeVisible();
  expect((await frame(page).boundingBox())!.width).toBeGreaterThanOrEqual(PHONE.width - 34);
  await expect(showVideo(page)).toHaveCount(0);
});

test("tucking the video away gives the text the screen, keeps the bar, and pages refit", async ({ page }) => {
  await openVideo(page);
  const before = await wordsShown(page);
  await tuck(page).click();
  await expect(frame(page)).toBeHidden();
  await expect(showVideo(page)).toBeVisible();
  const tab = (await showVideo(page).boundingBox())!;
  expect(tab.x + tab.width).toBeGreaterThanOrEqual(PHONE.width - 1);
  await expect(player(page)).toBeVisible();
  await expect.poll(() => wordsShown(page)).toBeGreaterThan(before);
  const top = (await article(page).boundingBox())!.y;
  const barTop = (await player(page).boundingBox())!.y;
  expect(barTop - top).toBeGreaterThanOrEqual(0.6 * PHONE.height);
});

test("swiping the handle sideways tucks the video away, a short swipe does not", async ({ page }) => {
  await openVideo(page);
  await swipe(page, 30);
  await expect(frame(page)).toBeVisible();
  await expect(showVideo(page)).toHaveCount(0);
  await swipe(page, 120);
  await expect(frame(page)).toBeHidden();
  await showVideo(page).click();
  await expect(frame(page)).toBeVisible();
  await swipe(page, -120);
  await expect(frame(page)).toBeHidden();
});

test("tucking a playing video pauses it, and Play brings it back before it plays", async ({ page }) => {
  await openVideo(page);
  await play(page).click();
  await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  await tuck(page).click();
  await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect((await calls(page)).at(-1)?.[0]).toBe("pause");
  await play(page).click();
  await expect(frame(page)).toBeVisible();
  await expect(showVideo(page)).toHaveCount(0);
  await expect.poll(async () => (await calls(page)).at(-1)).toEqual(["play", true]);
});

test("the tab brings the video back full width without playing it", async ({ page }) => {
  await openVideo(page);
  await tuck(page).click();
  const before = (await calls(page)).length;
  await showVideo(page).click();
  await expect(frame(page)).toBeVisible();
  expect((await frame(page).boundingBox())!.width).toBeGreaterThanOrEqual(PHONE.width - 34);
  await expect(showVideo(page)).toHaveCount(0);
  await expect(play(page)).toBeVisible();
  expect((await calls(page)).slice(before).some(([c]) => c === "play")).toBe(false);
});

test("the tucked choice is kept after a reload and in another lesson, and a laptop ignores it", async ({ page }) => {
  const first = await openVideo(page);
  await tuck(page).click();
  await expect(showVideo(page)).toBeVisible();
  await openReader(page, `/read/${first.id}`);
  await expect(showVideo(page)).toBeVisible();
  await expect(frame(page)).toBeHidden();
  const second = await createVideo(page);
  created.push(second);
  await openReader(page, `/read/${second.id}`);
  await expect(showVideo(page)).toBeVisible();

  await page.setViewportSize(LAPTOP);
  await openReader(page, `/read/${second.id}`);
  await expect(frame(page)).toBeVisible();
  expect((await frame(page).boundingBox())!.x).toBeGreaterThan((await article(page).boundingBox())!.x + 100);
  await expect(showVideo(page)).toBeHidden();
  await expect(tuck(page)).toBeHidden();
});
