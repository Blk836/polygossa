import { expect, test, type Locator, type Page } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

const word = (page: Page, n: number) => wordAt(page, n - 1);
const gapAfter = (page: Page, n: number) => article(page).locator(`[data-i="${2 * (n - 1) + 1}"]`);
const header = (page: Page) => page.locator(".font-reading.text-xl").first();
const chips = (page: Page) => page.getByRole("group", { name: "Words in this phrase" });
const chip = (page: Page, text: string) => chips(page).getByRole("button", { name: text, exact: true });

async function save(page: Page, c: Created, words: number[], status: string) {
  const term = words.map((n) => c.word(n)).join(" ");
  const kind = words.length > 1 ? "phrase" : "word";
  const res = await page.request.post("/api/vocabulary", { data: { language: c.language, term, displayTerm: term, kind, status } });
  expect(res.ok(), await res.text()).toBe(true);
  return term;
}

function stubLookups(page: Page, c: Created) {
  return page.route("**/api/dictionary?*", (route) => {
    const term = new URL(route.request().url()).searchParams.get("term") ?? "";
    return route.fulfill({ json: { term, language: c.language, meaningLanguage: "en", meanings: [`meaning of ${term}`], source: "sentence" } });
  });
}

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

const look = (l: Locator) => l.evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, line: s.textDecorationLine, left: parseFloat(s.borderTopLeftRadius), right: parseFloat(s.borderTopRightRadius) };
});

async function expectBackground(page: Page, l: Locator, token: string) {
  const want = await tokenColour(page, token);
  await expect.poll(async () => (await look(l)).bg).toBe(want);
}

async function phraseText(page: Page) {
  const c = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}. ${w(5)} ${w(2)}.`);
  created = c;
  await save(page, c, [3], "known");
  return c;
}

test.describe("a learning phrase is a yellow box", () => {
  test("it is one continuous box, rounded at its ends, with no underline", async ({ page }) => {
    const c = await phraseText(page);
    await save(page, c, [2, 3], "learning");
    await openReader(page, `/read/${c.id}`);
    for (const part of [word(page, 2), gapAfter(page, 2), word(page, 3)]) await expectBackground(page, part, "--w-learning");
    const [first, gap, last] = await Promise.all([look(word(page, 2)), look(gapAfter(page, 2)), look(word(page, 3))]);
    for (const s of [first, gap, last]) expect(s.line).toBe("none");
    expect(first.left).toBeGreaterThan(0);
    expect(first.right).toBe(0);
    expect([gap.left, gap.right]).toEqual([0, 0]);
    expect(last.left).toBe(0);
    expect(last.right).toBeGreaterThan(0);
  });

  test("known and ignored phrases are not boxed, and their words keep their own colours", async ({ page }) => {
    const c = await phraseText(page);
    await save(page, c, [1, 2], "known");
    await save(page, c, [3, 4], "ignored");
    await openReader(page, `/read/${c.id}`);
    await expectBackground(page, word(page, 2), "--w-new");
    await expectBackground(page, word(page, 4), "--w-new");
    await expect(article(page).locator(".p-learning")).toHaveCount(0);
  });

  test("overlapping learning phrases make one box, and each word opens the phrase it belongs to", async ({ page }) => {
    const c = await phraseText(page);
    await save(page, c, [2, 3], "learning");
    const later = await save(page, c, [3, 4], "learning");
    await stubLookups(page, c);
    await openReader(page, `/read/${c.id}`);
    for (const n of [2, 3, 4]) await expectBackground(page, word(page, n), "--w-learning");
    await expectBackground(page, gapAfter(page, 3), "--w-learning");
    const middle = await look(word(page, 3));
    expect([middle.left, middle.right]).toEqual([0, 0]);
    await word(page, 4).click();
    await expect(header(page)).toHaveText(later);
  });

  test("in dark mode the box uses the dark learning colour, like a learning word", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    const c = await phraseText(page);
    await save(page, c, [2, 3], "learning");
    await save(page, c, [5], "learning");
    await openReader(page, `/read/${c.id}`);
    await expectBackground(page, word(page, 5), "--w-learning");
    await expectBackground(page, word(page, 2), "--w-learning");
    expect((await look(word(page, 2))).bg).not.toBe("rgb(251, 227, 164)");
  });
});

test.describe("the words of a phrase stay reachable", () => {
  test("clicking any word opens the phrase, which lists its words in their own colours", async ({ page }) => {
    const c = await phraseText(page);
    const phrase = await save(page, c, [2, 3], "learning");
    await stubLookups(page, c);
    await openReader(page, `/read/${c.id}`);
    await word(page, 3).click();
    await expect(header(page)).toHaveText(phrase);
    await expect(page.getByText(`meaning of ${phrase}`)).toBeVisible();
    await expect(chips(page).getByRole("button")).toHaveText([c.word(2), c.word(3)]);
    await expect(chip(page, c.word(2))).toHaveAttribute("data-status", "new");
    await expect(chip(page, c.word(3))).toHaveAttribute("data-status", "known");
  });

  test("choosing a word opens it, and the way back reopens the phrase", async ({ page }) => {
    const c = await phraseText(page);
    const phrase = await save(page, c, [2, 3], "learning");
    await stubLookups(page, c);
    await openReader(page, `/read/${c.id}`);
    await word(page, 2).click();
    await chip(page, c.word(2)).click();
    await expect(header(page)).toHaveText(c.word(2));
    await expect(page.getByText(`meaning of ${c.word(2)}`)).toBeVisible();
    await expect(chips(page)).toHaveCount(0);
    await page.getByRole("button", { name: `Back to ${phrase}` }).click();
    await expect(header(page)).toHaveText(phrase);
    await expect(chips(page)).toBeVisible();
  });

  test("changing a word from inside the phrase changes it everywhere and leaves the phrase learning", async ({ page }) => {
    const c = await phraseText(page);
    const phrase = await save(page, c, [2, 3], "learning");
    await stubLookups(page, c);
    await openReader(page, `/read/${c.id}`);
    await word(page, 2).click();
    await chip(page, c.word(2)).click();
    await expect(header(page)).toHaveText(c.word(2));
    const saved = page.waitForResponse((r) => r.url().endsWith("/api/vocabulary") && r.request().method() === "POST");
    await page.getByRole("button", { name: "Learning", exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await page.getByRole("button", { name: `Back to ${phrase}` }).click();
    await expect(chip(page, c.word(2))).toHaveAttribute("data-status", "learning");
    await expectBackground(page, word(page, 6), "--w-learning");
    await expectBackground(page, gapAfter(page, 2), "--w-learning");
  });

  test("opening a word from the phrase doesn't save it", async ({ page }) => {
    const c = await phraseText(page);
    await save(page, c, [2, 3], "learning");
    await stubLookups(page, c);
    await openReader(page, `/read/${c.id}`);
    await word(page, 2).click();
    await chip(page, c.word(2)).click();
    await expect(header(page)).toHaveText(c.word(2));
    await expectBackground(page, word(page, 6), "--w-new");
  });

  test("the same word outside the phrase opens as a word", async ({ page }) => {
    const c = await phraseText(page);
    await save(page, c, [2, 3], "learning");
    await stubLookups(page, c);
    await openReader(page, `/read/${c.id}`);
    await word(page, 6).click();
    await expect(header(page)).toHaveText(c.word(2));
    await expect(page.getByText("Phrase", { exact: true })).toHaveCount(0);
  });
});
