import { expect, test, type Page } from "@playwright/test";
import { signUp } from "./photo-helpers";
import { addSyncedAudio, cleanUp, createText, openReader, player, TALL, type Created } from "./reader-helpers";
import { current, firstWordOf, markKnownCalls, nextSentence, onSentence, previousSentence, sentenceWord, setSentenceView } from "./sentence-helpers";

let created: Created | null = null;

test.use({ viewport: TALL });

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

async function openSentences(page: Page, opts: { cookie?: string; path?: string; audio?: number } = {}) {
  await setSentenceView(page, opts.cookie);
  created = await createText(page, 300);
  if (opts.audio) await addSyncedAudio(page, created.id, opts.audio);
  await openReader(page, `/read/${created.id}${opts.path ?? ""}`);
}

async function save(page: Page, term: string, status: "learning" | "known") {
  const res = await page.request.post("/api/vocabulary", { data: { language: created!.language, term, status } });
  expect(res.ok(), await res.text()).toBe(true);
}

const range = (n: number) => ({ fromToken: 2 * firstWordOf(n), toToken: 2 * firstWordOf(n + 1) - 1 });

test.describe("moving on marks new words known", () => {
  test("moving forward marks the sentence's remaining blue words known, leaving yellow ones, and the count goes up", async ({ page }) => {
    let header = 0;
    await page.route("**/api/dashboard/header*", (route) => {
      header++;
      return route.fulfill({ json: { current: 1, best: 1, activeToday: true, secondsLeftToday: 3600, knownWords: header * 100 } });
    });
    const calls = markKnownCalls(page);
    await setSentenceView(page);
    created = await createText(page, 300);
    await save(page, created.word(firstWordOf(2) + 1), "learning");
    await save(page, created.word(firstWordOf(2) + 2), "known");
    await openReader(page, `/read/${created.id}?page=2`);
    await expect(sentenceWord(page, 2, 1)).toHaveClass(/w-learning/);
    const before = header;
    const saved = page.waitForResponse((r) => r.url().includes("/mark-known"));
    await nextSentence(page).click();
    expect((await saved).ok()).toBe(true);
    expect(calls).toEqual([range(2)]);
    await expect(sentenceWord(page, 2, 3)).toHaveClass(/w-known/);
    await expect(sentenceWord(page, 2, 1)).toHaveClass(/w-learning/);
    await expect.poll(() => header).toBeGreaterThan(before);
  });

  test("moving back marks nothing", async ({ page }) => {
    const calls = markKnownCalls(page);
    await openSentences(page, { path: "?page=5" });
    await previousSentence(page).click();
    await onSentence(page, 4, 30);
    await expect(sentenceWord(page, 5, 1)).toHaveClass(/w-new/);
    expect(calls).toHaveLength(0);
  });

  test("with the setting off, moving on marks nothing", async ({ page }) => {
    const calls = markKnownCalls(page);
    await openSentences(page, { cookie: "known%3D0" });
    await nextSentence(page).click();
    await onSentence(page, 2, 30);
    await expect(sentenceWord(page, 1, 1)).toHaveClass(/w-new/);
    expect(calls).toHaveLength(0);
  });

  test("a sentence with no blue words sends nothing", async ({ page }) => {
    const calls = markKnownCalls(page);
    await setSentenceView(page);
    created = await createText(page, 300);
    for (let k = 0; k < 10; k++) await save(page, created.word(k), "learning");
    await openReader(page, `/read/${created.id}`);
    await expect(sentenceWord(page, 1, 9)).toHaveClass(/w-learning/);
    await nextSentence(page).click();
    await onSentence(page, 2, 30);
    await page.waitForTimeout(500);
    expect(calls).toHaveLength(0);
  });

  test("if marking known fails, I'm told, the next sentence still shows and the words stay blue", async ({ page }) => {
    await page.route("**/api/texts/*/mark-known", (route) => route.fulfill({ status: 500, json: { code: "boom", message: "Could not save" } }));
    await openSentences(page);
    await nextSentence(page).click();
    await onSentence(page, 2, 30);
    await expect(page.getByText("Could not save")).toBeVisible();
    await expect(sentenceWord(page, 1, 1)).toHaveClass(/w-new/);
  });

  test("the last sentence offers the same finish as the last page", async ({ page }) => {
    await openSentences(page, { path: "?page=30" });
    await onSentence(page, 30, 30);
    await page.getByRole("button", { name: "Finish lesson" }).click();
    await expect(sentenceWord(page, 30, 1)).toHaveClass(/w-known/);
  });
});

test.describe("audio", () => {
  const play = (page: Page) => player(page).getByRole("button", { name: "Play", exact: true }).click();

  test("the spoken word is lit in the sentence, and the view follows the audio into the next one, marking it known", async ({ page }) => {
    const calls = markKnownCalls(page);
    await openSentences(page, { audio: 60 });
    await play(page);
    await expect(current(page).locator(".w-speaking")).toHaveCount(1, { timeout: 5_000 });
    await onSentence(page, 2, 30);
    await expect.poll(() => calls).toContainEqual(range(1));
    await expect(sentenceWord(page, 1, 1)).toHaveClass(/w-known/);
  });

  test("[ while playing goes back a sentence and marks nothing", async ({ page }) => {
    const calls = markKnownCalls(page);
    await openSentences(page, { audio: 1000, path: "?page=5", cookie: "known%3D0" });
    await play(page);
    await expect(current(page).locator(".w-speaking")).toHaveCount(1, { timeout: 5_000 });
    await page.keyboard.press("[");
    await onSentence(page, 4, 30);
    expect(calls).toHaveLength(0);
  });

  test("moving by hand while playing plays the new sentence from its start", async ({ page }) => {
    await openSentences(page, { audio: 1000, cookie: "known%3D0" });
    await play(page);
    await expect(sentenceWord(page, 1, 0)).toHaveClass(/w-speaking/, { timeout: 5_000 });
    await page.keyboard.press("ArrowRight");
    await onSentence(page, 2, 30);
    await expect(current(page).locator(".w-speaking")).toHaveCount(1, { timeout: 5_000 });
    await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("Pause after each sentence stops at the sentence's end, and Space carries on with the next", async ({ page }) => {
    await openSentences(page, { audio: 60, cookie: "known%3D0" });
    const toggle = page.getByRole("checkbox", { name: "Pause after each sentence" });
    await toggle.check();
    expect(decodeURIComponent((await page.context().cookies()).find((c) => c.name === "lector_reader")!.value)).toContain("each=1");
    await play(page);
    await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible({ timeout: 10_000 });
    await onSentence(page, 1, 30);
    await page.keyboard.press(" ");
    await onSentence(page, 2, 30);
    await expect(player(page).getByRole("button", { name: "Pause" })).toBeVisible();
  });

  test("a lesson without audio shows no player and no pause option", async ({ page }) => {
    await openSentences(page);
    await expect(player(page)).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Pause after each sentence" })).toHaveCount(0);
  });
});

test.describe("translation", () => {
  const reveal = (page: Page) => page.getByRole("button", { name: "Tap to see the translation" });

  test("on Pro the translation waits under a blur, is asked for on tap and only once per sentence", async ({ page }) => {
    const asked: string[] = [];
    await page.route("**/api/dictionary/translate", (route) => {
      asked.push(route.request().postDataJSON().text);
      return route.fulfill({ json: { translation: `In English ${asked.length}` } });
    });
    await openSentences(page, { path: "?page=5", cookie: "known%3D0" });
    await expect(reveal(page)).toBeVisible();
    expect(asked).toHaveLength(0);
    await reveal(page).click();
    await expect(page.getByText("In English 1")).toBeVisible();
    expect(asked[0]).toContain(created!.word(firstWordOf(5)));
    await nextSentence(page).click();
    await expect(reveal(page)).toBeVisible();
    await expect(page.getByText("In English 1")).toHaveCount(0);
    await previousSentence(page).click();
    await reveal(page).click();
    await expect(page.getByText("In English 1")).toBeVisible();
    expect(asked).toHaveLength(1);
  });

  test("when translation fails, a short message shows and the words keep working", async ({ page }) => {
    await page.route("**/api/dictionary/translate", (route) => route.fulfill({ status: 429, json: { code: "allowance", message: "You've used today's AI allowance" } }));
    await openSentences(page, { cookie: "known%3D0" });
    await reveal(page).click();
    await expect(page.getByText("You've used today's AI allowance")).toBeVisible();
    await sentenceWord(page, 1, 2).click();
    await expect(page.getByTestId("meanings")).toBeVisible();
  });

  test("without Pro the translation area points to Pro", async ({ browser }) => {
    const { context, page } = await signUp(browser, "Free reader", TALL);
    await setSentenceView(page);
    const mine = await createText(page, 30);
    await openReader(page, `/read/${mine.id}`);
    await expect(page.getByRole("link", { name: "Sentence translations with Pro" })).toHaveAttribute("href", "/settings/subscription");
    await expect(page.getByRole("button", { name: "Tap to see the translation" })).toHaveCount(0);
    await cleanUp(page, mine);
    await context.close();
  });
});
