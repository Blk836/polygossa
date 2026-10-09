import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  addSyncedAudio,
  article,
  bottomPager,
  cleanUp,
  createText,
  createTextWith,
  createVideo,
  openReader,
  pager,
  PER_SENTENCE,
  popupClose,
  setReaderCookie,
  TALL,
  wordAt,
  type Created,
} from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const NONE = "rgba(0, 0, 0, 0)";

async function tokenColour(page: Page, name: string): Promise<string> {
  return page.evaluate((v) => {
    const probe = document.createElement("span");
    probe.style.background = `var(${v})`;
    document.querySelector("article")!.appendChild(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }, name);
}

async function expectBackground(page: Page, word: Locator, token: string | null) {
  const want = token ? await tokenColour(page, token) : NONE;
  await expect.poll(() => word.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(want);
}

async function expectSpeakingShown(page: Page) {
  await expect(page.getByTestId("follow-marker")).toBeVisible();
  const want = await tokenColour(page, "--w-sentence");
  await expect.poll(() => page.evaluate(() => {
    const gap = document.querySelector("article span.s-spoken:not(.w)");
    return gap ? getComputedStyle(gap).backgroundColor : "no sentence spoken";
  })).toBe(want);
}

async function saveStatus(page: Page, c: Created, term: string, status: string, kind = "word") {
  const res = await page.request.post("/api/vocabulary", { data: { language: c.language, term, displayTerm: term, kind, status } });
  expect(res.ok(), await res.text()).toBe(true);
}

const vocabularyWrite = (page: Page) =>
  page.waitForResponse((r) => r.url().endsWith("/api/vocabulary") && r.request().method() === "POST");
const statusButton = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

test.describe("word colours", () => {
  test("new words are blue; non-word tokens are never highlighted", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    await expect(wordAt(page, 1)).toHaveClass(/w-new/);
    await expectBackground(page, wordAt(page, 1), "--w-new");
    const texts = await article(page).locator(".w").allTextContents();
    expect(texts.length).toBeGreaterThan(0);
    expect(texts.filter((t) => !/^\p{L}+$/u.test(t))).toEqual([]);
  });

  test("clicking a new word makes every occurrence yellow; Known clears it; Unsave makes it blue again", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    const repeated = [0, PER_SENTENCE, 2 * PER_SENTENCE];
    await expectBackground(page, wordAt(page, PER_SENTENCE), "--w-new");

    const saved = vocabularyWrite(page);
    await wordAt(page, 0).click();
    expect((await saved).ok()).toBe(true);
    await popupClose(page).click();
    for (const n of repeated) await expectBackground(page, wordAt(page, n), "--w-learning");

    await wordAt(page, 0).click();
    await statusButton(page, "Known").click();
    await popupClose(page).click();
    for (const n of repeated) {
      await expect(wordAt(page, n)).toHaveClass(/w-known/);
      await expectBackground(page, wordAt(page, n), null);
    }

    await wordAt(page, PER_SENTENCE).click();
    await statusButton(page, "Unsave").click();
    await popupClose(page).click();
    for (const n of repeated) await expectBackground(page, wordAt(page, n), "--w-new");
  });

  test("ignored words aren't highlighted", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 3).click();
    await statusButton(page, "Ignore").click();
    await popupClose(page).click();
    await expect(wordAt(page, 3)).toHaveClass(/w-ignored/);
    await expectBackground(page, wordAt(page, 3), null);
  });

  test("clicking a word already being learned keeps it yellow and saves nothing", async ({ page }) => {
    created = await createText(page, 120);
    await saveStatus(page, created, created.word(4), "learning");
    await openReader(page, `/read/${created.id}`);
    await expectBackground(page, wordAt(page, 4), "--w-learning");
    const writes: string[] = [];
    page.on("request", (r) => r.url().endsWith("/api/vocabulary") && r.method() === "POST" && writes.push(r.url()));
    await wordAt(page, 4).click();
    await popupClose(page).click();
    await expectBackground(page, wordAt(page, 4), "--w-learning");
    expect(writes).toEqual([]);
  });

  test("if saving fails the word goes back to blue and the notice is shown", async ({ page }) => {
    created = await createText(page, 120);
    await page.route("**/api/vocabulary", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 402, contentType: "application/json", body: '{"code":"upgrade_required","message":"Free accounts can save 500 words."}' })
        : route.continue(),
    );
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 2).click();
    await expect(page.getByText("Free accounts can save 500 words.")).toBeVisible();
    await popupClose(page).click();
    await expect(wordAt(page, 2)).toHaveClass(/w-new/);
    await expectBackground(page, wordAt(page, 2), "--w-new");
  });

  test("the selected word stands out over the blue", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 6).click();
    await expectBackground(page, wordAt(page, 6), "--w-active");
  });

  test("videos use the same colours", async ({ page }) => {
    created = await createVideo(page, 120);
    await openReader(page, `/read/${created.id}`);
    await expectBackground(page, wordAt(page, 3), "--w-new");
    await wordAt(page, 3).click();
    await popupClose(page).click();
    await expectBackground(page, wordAt(page, 3), "--w-learning");
  });
});

test("caption annotations like [musique] are plain text, not words", async ({ page }) => {
  created = await createTextWith(page, (word) => `[musique] ${word(1)} ${word(2)}. [Applaudissements nourris]`);
  await openReader(page, `/read/${created.id}`);
  await expect(article(page)).toContainText("[musique]");
  await expect(article(page)).toContainText("[Applaudissements nourris]");
  await expect(article(page).locator(".w")).toHaveText([created.word(1), created.word(2)]);
  await expect(article(page).locator(".w-new")).toHaveCount(2);
});

test.describe("quiet colours", () => {
  test("hides the blue of new words; learning words stay yellow", async ({ page }) => {
    created = await createText(page, 120);
    await saveStatus(page, created, created.word(4), "learning");
    await setReaderCookie(page, "quiet%3D1");
    await openReader(page, `/read/${created.id}`);
    await expect(wordAt(page, 1)).toHaveClass(/w-new/);
    await expectBackground(page, wordAt(page, 1), null);
    await expectBackground(page, wordAt(page, 4), "--w-learning");
    await page.getByRole("button", { name: "Reader settings" }).click();
    await expect(page.getByRole("dialog", { name: "Reader settings" })).toContainText("Hide new-word highlighting.");
  });

  test("the word being spoken still shows, quiet or not", async ({ page }) => {
    created = await createText(page, 120);
    await addSyncedAudio(page, created.id);
    for (const quiet of [false, true]) {
      await setReaderCookie(page, quiet ? "quiet%3D1%26follow%3Dboth" : "follow%3Dboth");
      await openReader(page, `/read/${created.id}`);
      await page.keyboard.press("]");
      await expect(wordAt(page, PER_SENTENCE)).toHaveClass(/w-speaking/);
      await expectSpeakingShown(page);
    }
  });
});

test.describe("page turns and phrases", () => {
  test.use({ viewport: TALL });

  test("turning the page clears the blue on the page left; yellow words stay yellow", async ({ page }) => {
    created = await createText(page);
    await saveStatus(page, created, created.word(5), "learning");
    await openReader(page, `/read/${created.id}`);
    const marked = page.waitForResponse((r) => r.url().includes("/mark-known") && r.request().method() === "POST");
    await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    expect((await marked).ok()).toBe(true);
    await pager(page).getByRole("button", { name: "Previous page" }).click();
    await expectBackground(page, wordAt(page, 1), null);
    await expectBackground(page, wordAt(page, 5), "--w-learning");
  });

  test("only phrases being learned are underlined", async ({ page }) => {
    created = await createText(page, 120);
    const pair = (n: number) => `${created!.word(n)} ${created!.word(n + 1)}`;
    await saveStatus(page, created, pair(1), "learning", "phrase");
    await saveStatus(page, created, pair(3), "known", "phrase");
    await saveStatus(page, created, pair(5), "ignored", "phrase");
    await openReader(page, `/read/${created.id}`);
    const line = (n: number) => wordAt(page, n).evaluate((el) => getComputedStyle(el).textDecorationLine);
    expect(await line(1)).toBe("underline");
    expect(await line(3)).toBe("none");
    expect(await line(5)).toBe("none");
  });
});
