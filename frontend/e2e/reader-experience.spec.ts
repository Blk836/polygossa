import { expect, test, type Page } from "@playwright/test";
import {
  addSyncedAudio,
  article,
  bottomPager,
  cleanUp,
  createText,
  openReader,
  PAGE,
  pager,
  PER_SENTENCE,
  player,
  setReaderCookie,
  TALL,
  wordAt,
  type Created,
} from "./reader-helpers";

// The reader's controls, the same for texts, audio texts and videos: settings, shortcuts, the shared player bar and
// "turning the page marks new words known". Videos: reader-video.spec.ts.

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const settingsButton = (page: Page) => page.getByRole("button", { name: "Reader settings" });
const settingsMenu = (page: Page) => page.getByRole("dialog", { name: "Reader settings" });
const shortcutsMenu = (page: Page) => page.getByRole("dialog", { name: "Keyboard shortcuts" });

test.describe("reader settings", () => {
  test("text size and quiet colours are remembered and server-rendered", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    await expect(article(page)).toHaveClass(/text-xl/);
    await settingsButton(page).click();
    await settingsMenu(page).getByRole("button", { name: "Larger text" }).click();
    await settingsMenu(page).getByLabel("Quiet colours").check();
    await expect(article(page)).toHaveClass(/text-2xl/);
    await expect(article(page)).toHaveClass(/reader-quiet/);

    await page.reload();
    await expect(article(page)).toHaveClass(/text-2xl/);
    await expect(article(page)).toHaveClass(/reader-quiet/);
    const html = await (await page.request.get(`/read/${created.id}`)).text();
    expect(html).toMatch(/class="reading text-2xl[^"]*reader-quiet/);
  });

  test("the smallest and largest text sizes stop there", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    await settingsButton(page).click();
    const smaller = settingsMenu(page).getByRole("button", { name: "Smaller text" });
    const larger = settingsMenu(page).getByRole("button", { name: "Larger text" });
    await smaller.click();
    await expect(smaller).toBeDisabled();
    await expect(article(page)).toHaveClass(/text-lg/);
    for (let k = 0; k < 3; k++) await larger.click();
    await expect(larger).toBeDisabled();
    await expect(article(page)).toHaveClass(/text-3xl/);
  });

  test("an invalid saved value falls back to the defaults", async ({ page }) => {
    created = await createText(page, 120);
    await setReaderCookie(page, "size%3D9");
    await openReader(page, `/read/${created.id}`);
    await expect(article(page)).toHaveClass(/text-xl/);
    await settingsButton(page).click();
    await expect(settingsMenu(page).getByLabel("Pause when looking up a word")).toBeChecked();
    await expect(settingsMenu(page).getByLabel("Turning the page marks new words known")).toBeChecked();
  });

  test("the menu closes with Escape or a click outside", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    await settingsButton(page).click();
    await expect(settingsMenu(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(settingsMenu(page)).toHaveCount(0);
    await settingsButton(page).click();
    await page.getByRole("heading", { level: 1 }).click();
    await expect(settingsMenu(page)).toHaveCount(0);
  });

  test("the shortcuts list replaces the hint line and adds playback keys only with media", async ({ page }) => {
    created = await createText(page, 120);
    await openReader(page, `/read/${created.id}`);
    await expect(page.getByText("Click a word to look it up ·")).toHaveCount(0);
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(shortcutsMenu(page)).toContainText("Mark known");
    await expect(shortcutsMenu(page)).not.toContainText("Play / pause");

    await addSyncedAudio(page, created.id);
    await openReader(page, `/read/${created.id}`);
    await page.getByRole("button", { name: "Keyboard shortcuts" }).click();
    await expect(shortcutsMenu(page)).toContainText("Play / pause");
    await expect(shortcutsMenu(page)).toContainText("Replay sentence");
  });
});

test.describe("turning the page marks new words known", () => {
  test.use({ viewport: TALL }); // 250-word pages
  const markKnown = (page: Page) =>
    page.waitForResponse((r) => r.url().includes("/mark-known") && r.request().method() === "POST");

  test("the page's new words become known; words with a status and other pages are untouched", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 5).click(); // saved as learning
    await page.keyboard.press("Escape");
    await expect(wordAt(page, 5)).toHaveClass(/w-learning/);
    const distinct = PAGE - PAGE / PER_SENTENCE + 1; // 226 distinct words on page 1
    await expect(bottomPager(page)).toContainText(`Turning the page marks the ${distinct - 1} new words on this page as known.`);

    const saved = markKnown(page);
    await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    expect((await saved).ok()).toBe(true);
    await expect(pager(page)).toContainText("Page 2 of 4");
    await expect(wordAt(page, PAGE)).toHaveClass(/w-known/); // the repeated word was on page 1 too
    await expect(wordAt(page, PAGE + 1)).not.toHaveClass(/w-known/);
    const unique = 1000 - 1000 / PER_SENTENCE + 1;
    await expect(page.getByText(`${unique - 1 - (distinct - 1)} new · 1 learning`)).toBeVisible();

    await pager(page).getByRole("button", { name: "Previous page" }).click();
    await expect(wordAt(page, 1)).toHaveClass(/w-known/);
    await expect(wordAt(page, PAGE - 1)).toHaveClass(/w-known/);
    await expect(wordAt(page, 5)).toHaveClass(/w-learning/);
  });

  test("the known-words count in the top bar goes up without leaving the reader", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const known = page.getByRole("banner").getByTestId("known-words");
    await expect(known).toHaveText(/known/);
    const count = async () => Number((await known.textContent())!.replace(/\D/g, ""));
    const before = await count();
    const distinct = PAGE - PAGE / PER_SENTENCE + 1;
    // Other tests share the account, so the count is checked against what the header asked for after the turn.
    const header = page.waitForResponse((r) => r.url().includes("/api/dashboard/header"));
    const saved = markKnown(page);
    await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    expect((await saved).ok()).toBe(true);
    const after = (await (await header).json()).knownWords as number;
    expect(after).toBeGreaterThanOrEqual(before + distinct);
    await expect(known).toHaveText(`${after.toLocaleString("en-US")} known`);
  });

  test("setting a word's status in the reader updates the count in the top bar", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const known = page.getByRole("banner").getByTestId("known-words");
    await expect(known).toHaveText(/known/);
    // Other tests share the account, so each count is checked against what the header asked for after the change.
    const shown = async (change: () => Promise<void>) => {
      const header = page.waitForResponse((r) => r.url().includes("/api/dashboard/header"));
      await change();
      const value = (await (await header).json()).knownWords as number;
      await expect(known).toHaveText(`${value.toLocaleString("en-US")} known`);
      return value;
    };
    const learning = await shown(() => wordAt(page, 5).click()); // looking a word up saves it as learning
    await expect(wordAt(page, 5)).toHaveClass(/w-learning/);
    expect(await shown(() => page.getByRole("button", { name: "Known", exact: true }).click())).toBeGreaterThanOrEqual(learning + 1);
    await expect(wordAt(page, 5)).toHaveClass(/w-known/);
  });

  test("going back, or following a link, marks nothing", async ({ page }) => {
    created = await createText(page);
    const calls: string[] = [];
    page.on("request", (r) => r.url().includes("/mark-known") && calls.push(r.url()));
    await openReader(page, `/read/${created.id}?page=3`);
    await page.keyboard.press("ArrowLeft");
    await expect(pager(page)).toContainText("Page 2 of 4");
    await pager(page).getByRole("button", { name: "Previous page" }).click();
    await expect(pager(page)).toContainText("Page 1 of 4");
    await expect(wordAt(page, 1)).not.toHaveClass(/w-known/);
    expect(calls).toEqual([]);
  });

  test("the arrow key turns forward like Next", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}`);
    const saved = markKnown(page);
    await page.keyboard.press("ArrowRight");
    expect((await saved).ok()).toBe(true);
    await expect(pager(page)).toContainText("Page 2 of 4");
  });

  test("switched off, turning the page marks nothing and the note goes away", async ({ page }) => {
    created = await createText(page);
    const calls: string[] = [];
    page.on("request", (r) => r.url().includes("/mark-known") && calls.push(r.url()));
    await openReader(page, `/read/${created.id}`);
    await settingsButton(page).click();
    await settingsMenu(page).getByLabel("Turning the page marks new words known").uncheck();
    await page.keyboard.press("Escape");
    await expect(bottomPager(page)).not.toContainText("Turning the page");
    await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    await expect(pager(page)).toContainText("Page 2 of 4");
    await pager(page).getByRole("button", { name: "Previous page" }).click();
    await expect(wordAt(page, 1)).not.toHaveClass(/w-known/);
    expect(calls).toEqual([]);
  });

  test("if saving fails the words stay new and an error is shown", async ({ page }) => {
    created = await createText(page);
    await page.route("**/api/texts/*/mark-known", (route) =>
      route.fulfill({ status: 500, contentType: "application/json", body: '{"code":"internal","message":"Something went wrong"}' }),
    );
    await openReader(page, `/read/${created.id}`);
    await bottomPager(page).getByRole("button", { name: "Next page" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Something went wrong" })).toBeVisible();
    await pager(page).getByRole("button", { name: "Previous page" }).click();
    await expect(wordAt(page, 1)).not.toHaveClass(/w-known/);
  });

  test("the last page has no note (Finish lesson covers it)", async ({ page }) => {
    created = await createText(page);
    await openReader(page, `/read/${created.id}?page=4`);
    await expect(bottomPager(page)).not.toContainText("Turning the page");
    await expect(page.getByRole("button", { name: "Finish lesson" })).toBeVisible();
  });
});

test.describe("the shared player bar", () => {
  const audioRate = (page: Page) => page.locator("audio").evaluate((a) => (a as HTMLAudioElement).playbackRate);

  async function openWithAudio(page: Page, words = 1000) {
    created = await createText(page, words);
    await addSyncedAudio(page, created.id);
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toContainText("1:00"); // metadata loaded
  }

  test("audio texts get the full set of controls", async ({ page }) => {
    await openWithAudio(page);
    for (const name of ["Play", "Previous sentence", "Next sentence", "Replay sentence", "Loop sentence"]) {
      await expect(player(page).getByRole("button", { name, exact: true }), name).toBeVisible();
    }
    await expect(player(page).getByRole("combobox", { name: "Speed" }).locator("option")).toHaveText(["0.5×", "0.75×", "0.9×", "1×", "1.25×", "1.5×"]);
    await expect(player(page).getByRole("slider", { name: "Seek" })).toBeVisible();
    await expect(player(page).getByRole("group", { name: "Sentence timeline" })).toHaveCount(0);
  });

  test("[ ] and R step between sentences and replay", async ({ page }) => {
    // Stepping plays on from the sentence: 40 words over the minute keep each word spoken for 1.5s while it's checked.
    await openWithAudio(page, 40);
    await page.keyboard.press("]");
    await expect(wordAt(page, PER_SENTENCE)).toHaveClass(/w-speaking/);
    await page.keyboard.press("]");
    await expect(wordAt(page, 2 * PER_SENTENCE)).toHaveClass(/w-speaking/);
    await page.keyboard.press("[");
    await expect(wordAt(page, PER_SENTENCE)).toHaveClass(/w-speaking/);
    await page.keyboard.press("r");
    await expect(wordAt(page, PER_SENTENCE)).toHaveClass(/w-speaking/);
    await player(page).getByRole("button", { name: "Next sentence" }).click();
    await expect(wordAt(page, 2 * PER_SENTENCE)).toHaveClass(/w-speaking/);
  });

  test("Space plays and pauses", async ({ page }) => {
    await openWithAudio(page);
    await page.keyboard.press(" ");
    await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await page.keyboard.press(" ");
    await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("loop and speed controls", async ({ page }) => {
    await openWithAudio(page);
    const loop = player(page).getByRole("button", { name: "Loop sentence" });
    await loop.click();
    await expect(loop).toHaveAttribute("aria-pressed", "true");
    await loop.click();
    await expect(loop).toHaveAttribute("aria-pressed", "false");
    await player(page).getByRole("combobox", { name: "Speed" }).selectOption("1.5");
    expect(await audioRate(page)).toBe(1.5);
  });

  test("looking up a word pauses playback", async ({ page }) => {
    await openWithAudio(page);
    await page.keyboard.press(" ");
    await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await wordAt(page, 3).click();
    await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
  });

  test("with pause on lookup switched off, playback continues", async ({ page }) => {
    await setReaderCookie(page, "pause%3D0");
    await openWithAudio(page);
    await page.keyboard.press(" ");
    await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await wordAt(page, 3).click();
    await expect(page.getByRole("button", { name: "Close", exact: true })).toBeVisible();
    await expect(player(page).getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    await player(page).getByRole("button", { name: "Pause", exact: true }).click();
  });
});
