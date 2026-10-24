import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createText, createTextWith, openReader, pager, popupClose, TALL, wordAt, type Created } from "./reader-helpers";
import { after, before, current, firstWordOf, nextSentence, onSentence, previousSentence, sentenceNav, sentenceWord, useSentenceView } from "./sentence-helpers";

let created: Created | null = null;

test.use({ viewport: TALL });

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

async function openSentences(page: Page, words = 300, path = "") {
  await useSentenceView(page, "known%3D0");
  created = await createText(page, words);
  await openReader(page, `/read/${created.id}${path}`);
}

const settings = (page: Page) => page.getByRole("button", { name: "Reader settings" });
const viewChoice = (page: Page, name: string) => page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name });
const fontSize = (page: Page, el: ReturnType<typeof current>) => el.evaluate((e) => parseFloat(getComputedStyle(e).fontSize));

test("View is a reader setting, Pages by default, and Sentences is remembered for the next lesson's first paint", async ({ page }) => {
  created = await createText(page, 300);
  await openReader(page, `/read/${created.id}`);
  await settings(page).click();
  await expect(viewChoice(page, "Pages")).toHaveAttribute("aria-checked", "true");
  await viewChoice(page, "Sentences").click();
  await expect(viewChoice(page, "Sentences")).toHaveAttribute("aria-checked", "true");
  await onSentence(page, 1, 30);
  await expect(pager(page)).toHaveCount(0);
  const cookies = await page.context().cookies();
  expect(decodeURIComponent(cookies.find((c) => c.name === "lector_reader")!.value)).toContain("view=sentences");

  const html = await (await page.request.get(`/read/${created.id}`)).text();
  expect(html).toContain('data-sentence="current"');
});

test("switching view keeps my place both ways", async ({ page }) => {
  created = await createText(page, 1000);
  await openReader(page, `/read/${created.id}?page=3`);
  await expect(pager(page)).toContainText("Page 3 of 4");
  const first = Number(await article(page).locator("[data-i]").first().getAttribute("data-i")) / 2;
  await settings(page).click();
  await viewChoice(page, "Sentences").click();
  const n = Math.floor(first / 10) + 1;
  await onSentence(page, n, 100);
  await page.keyboard.press("Escape");
  await nextSentence(page).click();
  await nextSentence(page).click();
  await onSentence(page, n + 2, 100);
  await settings(page).click();
  await viewChoice(page, "Pages").click();
  await expect(wordAt(page, firstWordOf(n + 2))).toBeVisible();
  await expect(pager(page)).toContainText("Page 3 of 4");
});

test("reopening a lesson returns to the sentence I was on", async ({ page }) => {
  await openSentences(page, 300);
  for (let k = 1; k < 12; k++) {
    const saved = page.waitForResponse((r) => r.url().includes("/progress"));
    await page.keyboard.press("ArrowRight");
    await saved;
  }
  await onSentence(page, 12, 30);
  await openReader(page, `/read/${created!.id}`);
  await onSentence(page, 12, 30);
});

test("one sentence in focus, its neighbours smaller and faded around it, and A+ grows it", async ({ page }) => {
  await openSentences(page, 300, "?page=5");
  await onSentence(page, 5, 30);
  await expect(before(page).locator(`[data-i="${2 * firstWordOf(4)}"]`)).toBeVisible();
  await expect(after(page).locator(`[data-i="${2 * firstWordOf(6)}"]`)).toBeVisible();
  for (const side of [before(page), after(page)]) {
    expect(Number(await side.evaluate((e) => getComputedStyle(e).opacity))).toBeLessThan(0.8);
    expect(await fontSize(page, side)).toBeLessThan(await fontSize(page, current(page)));
  }
  const [box, view] = [await current(page).boundingBox(), page.viewportSize()!];
  expect(Math.abs(box!.x + box!.width / 2 - view.width / 2)).toBeLessThan(80);
  const size = await fontSize(page, current(page));
  await settings(page).click();
  await page.getByRole("button", { name: "Larger text" }).click();
  await expect.poll(() => fontSize(page, current(page))).toBeGreaterThan(size);
});

test("the first and last sentences have nothing on one side", async ({ page }) => {
  await openSentences(page, 300);
  await onSentence(page, 1, 30);
  await expect(before(page)).toHaveCount(0);
  await expect(previousSentence(page)).toBeDisabled();
  await openReader(page, `/read/${created!.id}?page=30`);
  await onSentence(page, 30, 30);
  await expect(after(page)).toHaveCount(0);
  await expect(nextSentence(page)).toBeDisabled();
});

test("a lesson of a single sentence has both ways disabled", async ({ page }) => {
  await useSentenceView(page);
  created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)}.`);
  await openReader(page, `/read/${created.id}`);
  await expect(current(page)).toContainText(created.word(1));
  await expect(sentenceNav(page)).toContainText("1 / 1");
  await expect(previousSentence(page)).toBeDisabled();
  await expect(nextSentence(page)).toBeDisabled();
});

test("progress through the lesson is shown", async ({ page }) => {
  await openSentences(page, 840, "?page=12");
  await onSentence(page, 12, 84);
  await expect(sentenceNav(page).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "12");
  await expect(sentenceNav(page).getByRole("progressbar")).toHaveAttribute("aria-valuemax", "84");
});

test("a sentence too long for the screen scrolls inside its own area, never the window", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await useSentenceView(page);
  created = await createTextWith(page, (w) => `${w(1)} ${w(2)}. ${Array.from({ length: 400 }, (_, k) => w(k + 3)).join(" ")}. ${w(500)} ${w(501)}.`);
  await openReader(page, `/read/${created.id}?page=2`);
  await expect(sentenceNav(page)).toContainText("2 / 3");
  const scroller = current(page);
  await expect.poll(() => scroller.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(1);
});

const moves: [string, (page: Page) => Promise<void>, number][] = [
  ["the right arrow", (page) => page.keyboard.press("ArrowRight"), 6],
  ["the left arrow", (page) => page.keyboard.press("ArrowLeft"), 4],
  ['"Next sentence"', (page) => nextSentence(page).click(), 6],
  ['"Previous sentence"', (page) => previousSentence(page).click(), 4],
  ["the faded sentence below", (page) => after(page).click({ position: { x: 2, y: 2 } }), 6],
  ["the faded sentence above", (page) => before(page).click({ position: { x: 2, y: 2 } }), 4],
];

for (const [how, move, shown] of moves) {
  test(`${how} moves to sentence ${shown}, sliding into place`, async ({ page }) => {
    await openSentences(page, 300, "?page=5");
    await onSentence(page, 5, 30);
    await move(page);
    await onSentence(page, shown, 30);
    expect(await current(page).evaluate((e) => e.getAnimations().length)).toBeGreaterThan(0);
  });
}

for (const [dir, shown] of [[-1, 6], [1, 4]] as const) {
  test(`swiping ${dir < 0 ? "left" : "right"} on a phone moves to sentence ${shown}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSentences(page, 300, "?page=5");
    await onSentence(page, 5, 30);
    const box = (await current(page).boundingBox())!;
    const y = box.y + box.height / 2;
    const [from, to] = dir < 0 ? [box.x + box.width - 10, box.x + 10] : [box.x + 10, box.x + box.width - 10];
    const stage = article(page).locator("[data-sentence-stage]");
    await stage.dispatchEvent("pointerdown", { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: from, clientY: y });
    await stage.dispatchEvent("pointerup", { pointerType: "touch", pointerId: 7, isPrimary: true, clientX: to, clientY: y + 5 });
    await onSentence(page, shown, 30);
  });
}

test("with reduced motion, the next sentence appears without sliding", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openSentences(page, 300, "?page=5");
  await nextSentence(page).click();
  await onSentence(page, 6, 30);
  expect(await current(page).evaluate((e) => e.getAnimations().length)).toBe(0);
});

test("clicking a word in a faded sentence opens that word and keeps the sentence in focus", async ({ page }) => {
  await openSentences(page, 300, "?page=5");
  await sentenceWord(page, 6, 3).click();
  await expect(page.getByTestId("meanings")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(created!.word(firstWordOf(6) + 3), { exact: true }).first()).toBeVisible();
  await onSentence(page, 5, 30);
});

test("words look and click as on pages: colours, quiet colours, the word card and its shortcuts", async ({ page }) => {
  await openSentences(page, 300, "?page=2");
  await expect(sentenceWord(page, 2, 1)).toHaveClass(/w-new/);
  await expect(sentenceWord(page, 3, 1)).toHaveClass(/w-new/);
  await sentenceWord(page, 2, 1).click();
  await expect(page.getByTestId("meanings")).toBeVisible();
  await page.keyboard.press("1");
  await expect(sentenceWord(page, 2, 1)).toHaveClass(/w-learning/);
  await popupClose(page).click();
  await settings(page).click();
  await page.getByText("Quiet colours").click();
  await expect(article(page)).toHaveClass(/reader-quiet/);
});

test("shift-click makes a phrase in the sentence in focus", async ({ page }) => {
  await openSentences(page, 300, "?page=2");
  await sentenceWord(page, 2, 2).click();
  await sentenceWord(page, 2, 4).click({ modifiers: ["Shift"] });
  await expect(page.getByText("Phrase", { exact: true })).toBeVisible();
});

test("Save sentence saves the sentence in focus as a phrase", async ({ page }) => {
  await openSentences(page, 300, "?page=2");
  const saved = page.waitForRequest((r) => r.url().endsWith("/api/vocabulary") && r.method() === "POST");
  await page.getByRole("button", { name: "Save sentence" }).click();
  const body = (await saved).postDataJSON();
  expect(body.kind).toBe("phrase");
  expect(body.term).toBe(Array.from({ length: 10 }, (_, k) => created!.word(10 + k)).join(" ") + ".");
  await expect(page.getByRole("button", { name: "✓ Sentence saved" })).toBeVisible();
});
