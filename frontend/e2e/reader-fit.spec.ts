import { expect, test, type Page } from "@playwright/test";
import {
  article,
  bottomPager,
  cleanUp,
  createText,
  createVideo,
  openReader,
  pager,
  PER_SENTENCE,
  player,
  setReaderCookie,
  TALL,
  type Created,
} from "./reader-helpers";

// Pages are cut to fit the window, so reading a page never needs scrolling; video transcripts flow their caption
// lines into paragraphs. Paging with full 250-word pages: reader-pages.spec.ts.

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const LAPTOP = { width: 1280, height: 720 };

/** How far the page scrolls (0 when it fits the window). */
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
const pageCount = async (page: Page) => Number((await pager(page).textContent())!.match(/of (\d+)/)![1]);
const next = (page: Page) => pager(page).getByRole("button", { name: "Next page" });
const wordsShown = (page: Page) => article(page).locator("[data-i]");

/** The first word on the page, as its token index. */
const firstWord = async (page: Page) => Number(await wordsShown(page).first().getAttribute("data-i"));

/** Turns through every page, checking that each one fits the window; returns the number of words seen. */
async function readThrough(page: Page, below?: () => Promise<number>) {
  const count = await pageCount(page);
  let words = 0;
  for (let n = 1; n <= count; n++) {
    await expect(pager(page)).toContainText(`Page ${n} of ${count}`);
    expect(await overflow(page), `page ${n} scrolls`).toBeLessThanOrEqual(0);
    if (below) {
      const lastWord = (await wordsShown(page).last().boundingBox())!;
      expect(lastWord.y + lastWord.height, `page ${n} runs under the player bar`).toBeLessThanOrEqual(await below());
    }
    words += await wordsShown(page).count();
    if (n < count) await next(page).click();
  }
  return words;
}

test.describe("pages fit the window", () => {
  test.use({ viewport: LAPTOP });
  test.beforeEach(async ({ page }) => {
    await setReaderCookie(page, "known%3D0");
  });

  test("on a laptop screen no page of a long text scrolls, the last page with Finish lesson included", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    expect(await pageCount(page)).toBeGreaterThan(4); // more pages than the 250-word ones a tall window gets
    expect(await readThrough(page)).toBe(1000); // every word once, none lost between pages
    await expect(page.getByRole("button", { name: "Finish lesson" })).toBeInViewport();
  });

  test("with the player bar open, the text stops above it", async ({ page }) => {
    created = await createVideo(page);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page).or(page.getByText("The video can't be played here"))).toBeVisible();
    const bar = page.locator("[data-bottom-bar]");
    const below = async () => ((await bar.count()) ? (await bar.boundingBox())!.y : Infinity);
    expect(await readThrough(page, below)).toBe(1000);
  });

  test("larger text means more, smaller pages, still without scrolling", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const normal = await pageCount(page);
    await setReaderCookie(page, "known%3D0%26size%3D3");
    await openReader(page, `/read/${created.id}`);
    await expect(article(page)).toHaveClass(/text-3xl/);
    expect(await pageCount(page)).toBeGreaterThan(normal);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test("resizing the window refits the pages and keeps the reader at the same place", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    await next(page).click();
    await next(page).click();
    await expect(pager(page)).toContainText("Page 3 of");
    const first = await firstWord(page);
    const before = await pageCount(page);

    await page.setViewportSize(TALL);
    await expect.poll(() => pageCount(page)).toBeLessThan(before);
    await expect(article(page).locator(`[data-i="${first}"]`)).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await expect(page).toHaveURL(/\?page=\d+$/);
  });

  test("a short text that fits stays on one page with no page controls", async ({ page }) => {
    // Words are random letters, so 60 of them wrap to anything from 7 to 10 lines and the longest don't fit; 40 always do.
    created = await createText(page, 40);
    await openReader(page, `/read/${created.id}`);
    await expect(wordsShown(page)).toHaveCount(40);
    await expect(page.getByRole("navigation", { name: "Pages" })).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});

test("on a window too short for any text, pages keep three lines, and turning from the bottom scrolls back up", async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
  // Too short for three lines under the header and above the pager (the slim header of the wide reader fits three
  // lines in a 420 px window, so this is shorter).
  await page.setViewportSize({ width: 1280, height: 360 });
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  const lines = await article(page).evaluate((a) => Math.round(a.getBoundingClientRect().height / parseFloat(getComputedStyle(a).lineHeight)));
  expect(lines).toBe(3);
  await bottomPager(page).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  const second = Number(await wordsShown(page).last().getAttribute("data-i")) + 2; // words and spaces alternate
  await bottomPager(page).getByRole("button", { name: "Next page" }).click();
  await expect(pager(page)).toContainText("Page 2 of");
  await expect(article(page).locator(`[data-i="${second}"]`)).toBeInViewport();
});

test.describe("video transcripts read as paragraphs", () => {
  test.use({ viewport: LAPTOP });

  test("caption lines flow together: lines are full and paragraphs hold several sentences", async ({ page }) => {
    created = await createVideo(page); // one caption line per 10-word sentence
    await openReader(page, `/read/${created.id}`);
    const words = await wordsShown(page).count();
    // Not one paragraph per caption: the first holds five captions (or the whole page, if shorter).
    expect(await article(page).locator("p").first().locator("[data-i]").count()).toBe(Math.min(5 * PER_SENTENCE, words));
    expect(await article(page).locator("p").count()).toBeLessThanOrEqual(Math.ceil(words / (5 * PER_SENTENCE)));
    // Every line but a paragraph's last is full: the next line's first word would not have fitted on it.
    const short = await article(page).evaluate((a) => {
      const right = a.getBoundingClientRect().right;
      let found = 0;
      for (const p of a.querySelectorAll("p")) {
        const spans = [...p.querySelectorAll("[data-i]")].map((s) => s.getBoundingClientRect());
        for (let k = 1; k < spans.length; k++) {
          const wrapped = spans[k].top > spans[k - 1].top + 1;
          if (wrapped && spans[k - 1].right + 8 + spans[k].width < right) found++;
        }
      }
      return found;
    });
    expect(short).toBe(0);
  });

  test("imported texts keep their own paragraphs", async ({ page }) => {
    await page.goto("/library");
    const me = await (await page.request.get("/api/me")).json();
    const res = await page.request.post("/api/texts", {
      data: { title: "Paragraph check", language: me.targetLanguage ?? "es", content: "Zqa zqb.\nZqc zqd.\n\nZqe zqf.", isPublic: false, category: "other" },
    });
    expect(res.ok(), await res.text()).toBe(true);
    const id = (await res.json()).id as number;
    try {
      await openReader(page, `/read/${id}`);
      await expect(article(page).locator("p")).toHaveText(["Zqa zqb.", "Zqc zqd.", "Zqe zqf."]);
    } finally {
      await page.request.delete(`/api/texts/${id}`);
    }
  });
});

// Leaving the reader detaches its page before effects are cleaned up; a page-fit measuring the detached page threw.
test("leaving the reader for another page throws no error", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  created = await createText(page);
  await openReader(page, `/read/${created.id}`);
  await expect(pager(page)).toContainText("Page 1 of");
  await page.getByRole("link", { name: /^Practice/ }).first().click(); // the header tab that opens Review
  await page.waitForURL("**/review");
  await page.waitForTimeout(500);
  expect(errors).toEqual([]);
});
