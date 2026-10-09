import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createVideo, openReader, player, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const FROZEN_YOUTUBE = `
window.YT = { Player: class {
  constructor(el, o) {
    this.o = o;
    el.replaceWith(document.createElement("iframe"));
    setTimeout(() => o.events.onReady({ target: this }));
  }
  playVideo() { this.o.events.onStateChange?.({ data: 1, target: this }); }
  pauseVideo() { this.o.events.onStateChange?.({ data: 2, target: this }); }
  seekTo() {}
  getCurrentTime() { return 0; }
  getDuration() { return 3600; }
  setPlaybackRate() {}
  destroy() {}
} };
window.onYouTubeIframeAPIReady?.();
`;

interface Timing { i: number; s: number; e: number }

async function timingsOf(page: Page, id: number): Promise<Timing[]> {
  const detail = await (await page.request.get(`/api/texts/${id}`)).json();
  return [...(detail.video.timings as Timing[])].sort((a, b) => a.s - b.s);
}

test("the highlight moves word by word between the player's time reports, up to a second ahead", async ({ page }) => {
  await page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: FROZEN_YOUTUBE }));
  created = await createVideo(page);
  await openReader(page, `/read/${created.id}`);
  await expect(player(page)).toContainText("60:00");
  await page.evaluate(() => {
    const seen: number[] = ((window as unknown as { __spoken: number[] }).__spoken = []);
    new MutationObserver(() => {
      for (const el of document.querySelectorAll("article [data-i].w-speaking")) {
        const i = Number(el.getAttribute("data-i"));
        if (seen.at(-1) !== i) seen.push(i);
      }
    }).observe(document.querySelector("article")!, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  const timings = await timingsOf(page, created.id);
  const between = timings.filter((t) => t.s >= 300 && t.s <= 800).map((t) => t.i);
  const beyond = timings.filter((t) => t.s > 1000).map((t) => t.i);
  expect(between.length).toBeGreaterThan(0);

  await player(page).getByRole("button", { name: "Play", exact: true }).click();
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: number[] }).__spoken);
  await expect.poll(async () => (await spoken()).some((i) => between.includes(i)), { timeout: 3000 }).toBe(true);
  await page.waitForTimeout(1000);
  expect((await spoken()).filter((i) => beyond.includes(i))).toEqual([]);
  await expect(article(page).locator(".w-speaking")).toHaveCount(1);
});
