import { expect, test, type Browser, type Page } from "@playwright/test";
import { cleanUp, createText, createVideo, openReader, pager, setReaderCookie, TALL, wordAt, type Created } from "./reader-helpers";

// Library and Explore cards: difficulty ("10% new · Stretch") in the card body, and reading progress as a bar along
// the bottom of the cover (or "Finished"). A 1,000-word text is four pages of 250 in this tall window, so page 3
// starts at word 500: 50% read. It has 901 unique words (every sentence starts with the same one).

test.use({ viewport: TALL });

let created: Created | null = null;

// Turning pages here should save progress, not mark words known (reader-experience.spec.ts covers that).
test.beforeEach(async ({ page }) => {
  await setReaderCookie(page, "known%3D0");
});

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

/** Every created title holds the text's unique word prefix. */
const title = () => created!.prefix;
const card = (page: Page) => page.getByTestId("card-grid").getByRole("article").filter({ hasText: title() });
const bar = (page: Page) => card(page).getByRole("progressbar", { name: "Reading progress" });
const finishedTag = (page: Page) => card(page).getByText("Finished", { exact: true });
const difficultyChip = (page: Page) => card(page).getByTestId("difficulty");

/** The progress the backend has for the text, once the reader's (beacon) save has arrived. */
async function savedProgress(page: Page) {
  const detail = await (await page.request.get(`/api/texts/${created!.id}`)).json();
  return detail.text.progress as { position: number; percent: number; completed: boolean } | undefined;
}

async function readPage(page: Page, n: number, percent: number) {
  await openReader(page, `/read/${created!.id}?page=${n}`);
  await expect(pager(page)).toContainText(`Page ${n} of 4`);
  await expect.poll(async () => (await savedProgress(page))?.percent).toBe(percent);
}

/** Marks words 0..n-1 known, as turning pages would. */
async function markKnown(page: Page, words: number) {
  const res = await page.request.post(`/api/texts/${created!.id}/mark-known`, { data: { fromToken: 0, toToken: 2 * words - 2 } });
  expect(res.ok(), await res.text()).toBe(true);
}

async function newDevice(browser: Browser, viewport = TALL) {
  return browser.newContext({ baseURL: "http://localhost:3000", viewport });
}

test.describe("difficulty", () => {
  test("shows the share of new words and its band, with the counts on hover", async ({ page }) => {
    created = await createText(page);
    await page.goto("/library");
    await expect(difficultyChip(page)).toContainText("100% new words");
    await expect(difficultyChip(page)).toContainText("Hard");
    await expect(difficultyChip(page)).toHaveAttribute("title", "901 of 901 unique words are new to you (0 known · 0 learning)");
  });

  test("updates after learning words", async ({ page }) => {
    test.slow(); // cleaning up 901 known words takes a while
    created = await createText(page);
    await markKnown(page, 900); // 811 of 901 unique words known, 90 new
    await page.goto("/library");
    await expect(difficultyChip(page)).toContainText("10% new words");
    await expect(difficultyChip(page)).toContainText("Stretch");
    await markKnown(page, 1000);
    await page.reload();
    await expect(difficultyChip(page)).toContainText("0% new words");
    await expect(difficultyChip(page)).toContainText("Easy");
  });

  test("replaces the old known-percentage bar", async ({ page }) => {
    created = await createText(page);
    await page.goto("/library");
    await expect(difficultyChip(page)).toBeVisible();
    await expect(card(page)).not.toContainText("known");
  });
});

test.describe("progress", () => {
  test("an item never opened has no bar and no Finished tag", async ({ page }) => {
    created = await createText(page);
    await page.goto("/library");
    await expect(difficultyChip(page)).toBeVisible();
    await expect(bar(page)).toHaveCount(0);
    await expect(finishedTag(page)).toHaveCount(0);
  });

  test("opening an item marks it started", async ({ page }) => {
    created = await createText(page);
    await readPage(page, 1, 0);
    await page.goto("/library");
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "0");
    await expect(bar(page)).toHaveAttribute("aria-valuetext", "Started");
  });

  test("shows how far the item has been read, on the cover, in every layout", async ({ page }) => {
    created = await createText(page);
    await readPage(page, 3, 50);
    for (const layout of ["cards", "compact", "list"]) {
      await page.context().addCookies([{ name: "lector_card_layout", value: layout === "cards" ? "" : layout, url: "http://localhost:3000" }]);
      await page.goto("/library");
      await expect(bar(page), layout).toHaveAttribute("aria-valuenow", "50");
      await expect(bar(page), layout).toHaveAttribute("aria-valuetext", "50% read");
      await expect(difficultyChip(page), layout).toBeVisible();
      // The bar sits on the cover, along its bottom edge.
      const cover = await card(page).locator("[data-cover]").boundingBox();
      const line = await bar(page).boundingBox();
      expect(Math.abs(line!.y + line!.height - (cover!.y + cover!.height)), layout).toBeLessThanOrEqual(1);
    }
  });

  test("the bar keeps the furthest point reached, and reopening resumes where reading stopped", async ({ page }) => {
    created = await createText(page);
    await readPage(page, 3, 50);
    await pager(page).getByRole("button", { name: "Previous page" }).click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    await expect.poll(async () => (await savedProgress(page))?.position).toBe(500);
    await page.goto("/library");
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "50");
    await openReader(page, `/read/${created.id}`);
    await expect(pager(page)).toContainText("Page 2 of 4");
  });

  test("finishing the lesson shows Finished instead of a bar, and re-reading keeps it", async ({ page }) => {
    test.slow(); // finishing marks 901 words known, which afterEach removes
    created = await createText(page);
    await readPage(page, 4, 75);
    await page.getByRole("button", { name: "Finish lesson" }).click();
    await expect.poll(async () => (await savedProgress(page))?.completed).toBe(true);
    await page.goto("/library");
    await expect(finishedTag(page)).toBeVisible();
    await expect(bar(page)).toHaveCount(0);

    await openReader(page, `/read/${created.id}?page=2`);
    await expect.poll(async () => (await savedProgress(page))?.position).toBe(500);
    await page.goto("/library");
    await expect(finishedTag(page)).toBeVisible();
    await openReader(page, `/read/${created.id}`);
    await expect(pager(page)).toContainText("Page 2 of 4");
  });

  test("Explore cards show progress and difficulty too", async ({ page }) => {
    created = await createText(page);
    const patch = await page.request.patch(`/api/texts/${created.id}`, { data: { isPublic: true } });
    expect(patch.ok()).toBe(true);
    await readPage(page, 3, 50);
    await page.goto("/community");
    const explore = page.getByRole("article").filter({ hasText: title() }).first();
    await expect(explore.getByRole("progressbar", { name: "Reading progress" })).toHaveAttribute("aria-valuenow", "50");
    await expect(explore.getByTestId("difficulty")).toContainText("Hard");
  });

  test("a video's thumbnail shows progress through its transcript", async ({ page }) => {
    created = await createVideo(page);
    await readPage(page, 3, 50);
    await page.goto("/library");
    await expect(bar(page)).toHaveAttribute("aria-valuenow", "50");
  });
});

test.describe("resuming", () => {
  test("progress follows the reader to another browser", async ({ page, browser }) => {
    created = await createText(page);
    await readPage(page, 3, 50);
    const other = await newDevice(browser);
    const p2 = await other.newPage();
    try {
      await p2.goto("/library");
      await expect(bar(p2)).toHaveAttribute("aria-valuenow", "50");
      await openReader(p2, `/read/${created.id}`);
      await expect(pager(p2)).toContainText("Page 3 of 4");
      await expect(wordAt(p2, 500)).toBeVisible();
    } finally {
      await other.close();
    }
  });

  test("on a phone-sized screen it resumes on the page holding the same word", async ({ page, browser }) => {
    created = await createText(page);
    await readPage(page, 3, 50);
    const phone = await newDevice(browser, { width: 375, height: 700 });
    const p2 = await phone.newPage();
    try {
      await openReader(p2, `/read/${created.id}`);
      await expect(wordAt(p2, 500)).toBeVisible();
      await expect(pager(p2)).not.toContainText("Page 3 of 4");
      await p2.goto("/library");
      await expect(bar(p2)).toHaveAttribute("aria-valuenow", "50");
    } finally {
      await phone.close();
    }
  });

  test("a page remembered by this browser before progress was saved is resumed and then saved", async ({ page }) => {
    created = await createText(page);
    const id = created.id;
    await page.addInitScript((key) => window.localStorage.setItem(key, "3"), `lector_page_${id}`);
    await openReader(page, `/read/${id}`);
    await expect(pager(page)).toContainText("Page 3 of 4");
    await expect.poll(async () => (await savedProgress(page))?.percent).toBe(50);
  });

  test("reading carries on when progress can't be saved, and the next page turn saves it", async ({ page }) => {
    created = await createText(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/texts/*/progress", (route) => route.abort());
    await openReader(page, `/read/${created.id}`);
    const next = pager(page).getByRole("button", { name: "Next page" });
    await next.click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    expect(await savedProgress(page)).toBeUndefined();

    await page.unroute("**/api/texts/*/progress");
    await next.click();
    await expect(pager(page)).toContainText("Page 3 of 4");
    await expect.poll(async () => (await savedProgress(page))?.percent).toBe(50);
    expect(errors).toEqual([]);
  });
});
