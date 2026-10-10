import { expect, test, type Locator, type Page } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, wordAt, type Created } from "./reader-helpers";

let created: Created | null = null;
const savedPhrases: string[] = [];

test.afterEach(async ({ page }) => {
  for (const term of savedPhrases.splice(0)) {
    await page.request.delete(`/api/vocabulary/by-term?language=${created!.language}&term=${encodeURIComponent(term)}`);
  }
  await cleanUp(page, created);
  created = null;
});

function stubLookups(page: Page, c: Created) {
  const asked: string[] = [];
  void page.route("**/api/dictionary?*", (route) => {
    asked.push(new URL(route.request().url()).searchParams.get("term") ?? "");
    return route.fulfill({ json: { term: "x", language: c.language, meaningLanguage: "en", meanings: ["x"], source: "sentence" } });
  });
  return asked;
}

async function savePhrase(page: Page, c: Created, words: number[], status = "learning") {
  const term = words.map((n) => c.word(n)).join(" ");
  const res = await page.request.post("/api/vocabulary", { data: { language: c.language, term, displayTerm: term, kind: "phrase", status } });
  expect(res.ok(), await res.text()).toBe(true);
  savedPhrases.push(term);
  return term;
}

async function dragAcross(page: Page, from: number, to: number, release = true) {
  await wordAt(page, from).scrollIntoViewIfNeeded();
  const a = (await wordAt(page, from).boundingBox())!;
  const b = (await wordAt(page, to).boundingBox())!;
  await page.mouse.move(a.x + 3, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  if (release) await page.mouse.up();
}

const style = (l: Locator) => l.evaluate((el) => {
  const s = getComputedStyle(el);
  return { bg: s.backgroundColor, left: parseFloat(s.borderTopLeftRadius), right: parseFloat(s.borderTopRightRadius), shadow: s.boxShadow, line: s.textDecorationLine };
});

async function expectOneBand(page: Page, parts: number) {
  const band = article(page).locator(".sel");
  await expect(band).toHaveCount(parts);
  const styles = await Promise.all((await band.all()).map(style));
  expect(new Set(styles.map((s) => s.bg)).size).toBe(1);
  expect(styles[0].bg).not.toBe("rgba(0, 0, 0, 0)");
  for (const s of styles) expect(s.shadow).toBe("none");
  expect(styles[0].left).toBeGreaterThan(0);
  expect(styles[0].right).toBe(0);
  expect(styles[parts - 1].right).toBeGreaterThan(0);
  expect(styles[parts - 1].left).toBe(0);
  for (const s of styles.slice(1, -1)) expect([s.left, s.right]).toEqual([0, 0]);
}

const header = (page: Page) => page.locator(".font-reading.text-xl").first();

test.describe("a selected phrase is one band", () => {
  test("dragging across three words highlights them and the spaces between as one band, already while dragging", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)} ${w(5)}.`);
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await dragAcross(page, 2, 4, false);
    await expectOneBand(page, 5);
    await page.mouse.up();
    await expect(page.getByText("Phrase", { exact: true })).toBeVisible();
    await expectOneBand(page, 5);
  });

  test("punctuation inside the phrase is part of the band", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)}, ${w(2)} ${w(3)}.`);
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await dragAcross(page, 1, 2);
    await expectOneBand(page, 3);
    await expect(article(page).locator(".sel").nth(1)).toHaveText(", ");
  });

  test("a phrase that wraps onto the next line is highlighted on both lines", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    created = await createTextWith(page, (w) => Array.from({ length: 12 }, (_, i) => w(i + 1)).join(" ") + ".");
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await dragAcross(page, 1, 8);
    const tops = await article(page).locator(".sel").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBeGreaterThan(1);
    await expectOneBand(page, 15);
  });

  test("the band stops at 12 words, and releasing opens those 12 as the phrase", async ({ page }) => {
    created = await createTextWith(page, (w) => Array.from({ length: 16 }, (_, i) => w(i + 1)).join(" ") + ".");
    const asked = stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await dragAcross(page, 2, 15, false);
    await expect(article(page).locator(".w.sel")).toHaveCount(12);
    await page.mouse.up();
    const twelve = Array.from({ length: 12 }, (_, i) => created!.word(i + 2)).join(" ");
    await expect(header(page)).toHaveText(twelve);
    await expect.poll(() => asked.at(-1)).toBe(twelve.toLowerCase());
  });

  test("a single clicked word is one rounded, outlined box as before", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)}.`);
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 2).click();
    const band = article(page).locator(".sel");
    await expect(band).toHaveCount(1);
    const s = await style(band.first());
    expect(s.left).toBeGreaterThan(0);
    expect(s.right).toBeGreaterThan(0);
    expect(s.shadow).not.toBe("none");
  });
});

test.describe("clicking a saved phrase", () => {
  test("a click on one of its words opens the phrase; the same word again opens the word alone", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`);
    const phrase = await savePhrase(page, created, [2, 3]);
    const asked = stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);

    await wordAt(page, 2).click();
    await expect(header(page)).toHaveText(phrase);
    await expect(page.getByText("Phrase", { exact: true })).toBeVisible();
    expect(asked).toContain(phrase);
    await expectOneBand(page, 3);

    await wordAt(page, 2).click();
    await expect(header(page)).toHaveText(created.word(2));
    await expect(page.getByText("Phrase", { exact: true })).toHaveCount(0);
  });

  test("a click on another word of the open phrase keeps the phrase open", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`);
    const phrase = await savePhrase(page, created, [2, 3]);
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 2).click();
    await expect(header(page)).toHaveText(phrase);
    await wordAt(page, 3).click();
    await expect(header(page)).toHaveText(phrase);
  });

  test("a word in two saved phrases opens the longer one", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)} ${w(5)}.`);
    await savePhrase(page, created, [2, 3]);
    const longer = await savePhrase(page, created, [2, 3, 4]);
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 3).click();
    await expect(header(page)).toHaveText(longer);
  });

  test("words outside saved phrases, and phrases marked known, open as single words", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`);
    await savePhrase(page, created, [2, 3], "known");
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 2).click();
    await expect(header(page)).toHaveText(created.word(2));
    await wordAt(page, 4).click();
    await expect(header(page)).toHaveText(created.word(4));
  });

  test("a saved phrase I'm learning is underlined without a gap at the space", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`);
    await savePhrase(page, created, [2, 3]);
    await openReader(page, `/read/${created.id}`);
    const underlined = article(page).locator(".p-learning");
    await expect(underlined).toHaveCount(3);
    await expect(underlined.nth(1)).toHaveText(" ");
    expect((await style(underlined.nth(1))).line).toContain("underline");
  });

  test("dragging across part of a saved phrase still selects a new phrase", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)} ${w(4)}.`);
    await savePhrase(page, created, [2, 3]);
    stubLookups(page, created);
    await openReader(page, `/read/${created.id}`);
    await dragAcross(page, 1, 2);
    await expect(header(page)).toHaveText(`${created.word(1)} ${created.word(2)}`);
  });
});
