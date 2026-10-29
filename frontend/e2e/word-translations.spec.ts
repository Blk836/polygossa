import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, popupClose, type Created } from "./reader-helpers";

function lookupAnswer(page: Page, created: Created, extra: Record<string, unknown>) {
  return page.route("**/api/dictionary?*", (route) =>
    route.fulfill({ json: { term: created.word(1), language: created.language, meaningLanguage: "en", ...extra } }),
  );
}

function vocabularyWrites(page: Page): Record<string, unknown>[] {
  const sent: Record<string, unknown>[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/vocabulary") && ["POST", "PATCH"].includes(r.method())) sent.push(r.postDataJSON() ?? {});
  });
  return sent;
}

async function openWord(page: Page, created: Created) {
  await openReader(page, `/read/${created.id}`);
  await article(page).getByText(created.word(1), { exact: true }).click();
}

test.describe("the word popup", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => {
    await cleanUp(page, created);
    created = null;
  });

  test("leads with the first meaning other learners saved, saves it, and a click on another makes it the headline", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["home", "house", "dwelling"], source: "community" });
    const sent = vocabularyWrites(page);
    await openWord(page, created);

    const line = page.getByTestId("meanings");
    const headline = page.getByTestId("meaning-headline");
    await expect(headline).toHaveText("home");
    await expect(page.getByTestId("meaning-also")).toHaveText("also: house · dwelling");
    await expect(page.getByTestId("meaning-source")).toHaveText("saved by other learners");
    await expect(line).not.toContainText("English");
    await expect(headline.getByRole("button", { name: "home" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("meaning-also").getByRole("button", { name: "house" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => sent.some((b) => b.meaning === "home" && b.definition === "home")).toBe(true);

    await page.getByTestId("meaning-also").getByRole("button", { name: "house" }).click();
    await expect(headline).toHaveText("house");
    await expect(headline.getByRole("button", { name: "house" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("meaning-also")).toHaveText("also: home · dwelling");
    const word = created.word(1);
    await expect.poll(async () => (await (await page.request.get(`/api/vocabulary?q=${word}`)).json()).items
      .filter((e: { term: string }) => e.term === word)
      .map((e: { meaning?: string; definition?: string }) => `${e.meaning}/${e.definition}`))
      .toEqual(["house/house"]);

    await headline.getByRole("button", { name: "house" }).click();
    await expect(headline).toHaveText("house");
    await expect(page.getByTestId("meaning-also")).toHaveText("also: home · dwelling");

    await popupClose(page).click();
    await article(page).getByText(created.word(1), { exact: true }).click();
    await expect(headline).toHaveText("house");
    await expect(page.getByTestId("meaning-also")).toHaveText("also: home · dwelling");
  });

  test("a single meaning is the headline alone, with a small source note", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["attainment"], source: "sentence" });
    await openWord(page, created);
    await expect(page.getByTestId("meaning-headline")).toHaveText("attainment");
    await expect(page.getByTestId("meaning-also")).toHaveCount(0);
    await expect(page.getByTestId("meaning-source")).toHaveText("in this sentence");
    await expect(page.getByTestId("meanings")).not.toContainText("English");
    const size = (id: string) => page.getByTestId(id).evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(await size("meaning-headline")).toBeGreaterThan(await size("meaning-source"));
  });

  test("a meaning with no known source has no note", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["perrito"], source: null });
    await openWord(page, created);
    await expect(page.getByTestId("meaning-headline")).toHaveText("perrito");
    await expect(page.getByTestId("meaning-source")).toHaveCount(0);
  });

  test("a long meaning wraps inside the popup on a phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 740 });
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    const long = "the state of having reached a particular level of achievement after a long effort";
    await lookupAnswer(page, created, { meanings: [long], source: "sentence" });
    await openWord(page, created);
    const headline = page.getByTestId("meaning-headline");
    await expect(headline).toHaveText(long);
    const box = await headline.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });

  test("a phrase leads with its first meaning the same way", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)} ${w(3)}.`);
    await lookupAnswer(page, created, { meanings: ["however", "nevertheless"], source: "sentence" });
    await openWord(page, created);
    await article(page).getByText(created.word(2), { exact: true }).click({ modifiers: ["Shift"] });
    await expect(page.getByText("Phrase", { exact: true })).toBeVisible();
    await expect(page.getByTestId("meaning-headline")).toHaveText("however");
    await expect(page.getByTestId("meaning-also")).toHaveText("also: nevertheless");
  });

  test("labels the meaning's source and links out to dictionaries in a new tab", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["refrigerator"], source: "sentence" });
    await openWord(page, created);

    await expect(page.getByTestId("meanings")).toContainText("refrigerator");
    await expect(page.getByTestId("meanings")).toContainText("in this sentence");
    const links = page.getByTestId("dictionary-links").getByRole("link");
    const word = encodeURIComponent(created.word(1));
    const from = created.language;
    await expect(links.getByText("Google Translate")).toHaveAttribute("href",
      `https://translate.google.com/?sl=${from}&tl=en&text=${word}&op=translate`);
    await expect(links.getByText("DeepL")).toHaveAttribute("href", `https://www.deepl.com/translator#${from}/en/${word}`);
    await expect(links.getByText("WordReference")).toHaveAttribute("href", `https://www.wordreference.com/${from}en/${word}`);
    for (const link of await links.all()) await expect(link).toHaveAttribute("target", "_blank");
  });

  test("says when there is no meaning yet, and still links out", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: [], source: null });
    await openWord(page, created);
    await expect(page.getByTestId("meanings")).toHaveText("No English meaning yet");
    await expect(page.getByTestId("meaning-headline")).toHaveCount(0);
    await expect(page.getByTestId("meaning-source")).toHaveCount(0);
    await expect(page.getByTestId("dictionary-links").getByRole("link")).toHaveCount(3);
  });

  test("sends the text around the clicked copy of the word with its lookup", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(2)} ${w(1)} ${w(3)} ${w(1)} ${w(4)}.`);
    const asked: URLSearchParams[] = [];
    await page.route("**/api/dictionary?*", (route) => {
      asked.push(new URL(route.request().url()).searchParams);
      return route.fulfill({ json: { term: created!.word(1), language: created!.language, meaningLanguage: "en", meanings: ["limping"], source: "sentence" } });
    });
    await openReader(page, `/read/${created.id}`);
    await article(page).getByText(created.word(1), { exact: true }).nth(1).click();

    await expect(page.getByTestId("meanings")).toContainText("limping");
    expect(asked).toHaveLength(1);
    expect(asked[0].get("term")).toBe(created.word(1));
    expect(asked[0].get("before")).toBe(`${created.word(2)} ${created.word(1)} ${created.word(3)} `);
    expect(asked[0].get("after")).toBe(` ${created.word(4)}.`);
  });

  test("labels a meaning found in this sentence, and saves it", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["standing", "upright"], source: "sentence" });
    const sent = vocabularyWrites(page);
    await openWord(page, created);

    await expect(page.getByTestId("meaning-headline")).toHaveText("standing");
    await expect(page.getByTestId("meaning-also")).toHaveText("also: upright");
    await expect(page.getByTestId("meaning-source")).toHaveText("in this sentence");
    await expect.poll(() => sent.some((b) => b.meaning === "standing")).toBe(true);
  });

  test("shows the word's type, form and dictionary form under the meaning, and saves the type with the word", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["will go"], source: "sentence",
      wordType: { partOfSpeech: "verb", form: "future, 1st person plural", lemma: "aller" } });
    const sent = vocabularyWrites(page);
    await openWord(page, created);

    await expect(page.getByTestId("meaning-headline")).toHaveText("will go");
    await expect(page.getByTestId("meaning-type")).toHaveText("verb · future, 1st person plural · from aller");
    await expect.poll(() => sent.some((b) => b.partOfSpeech === "verb · future, 1st person plural · from aller")).toBe(true);
  });

  test("shows no type line when the meaning has no type", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["refrigerator"], source: "sentence", wordType: null });
    const sent = vocabularyWrites(page);
    await openWord(page, created);
    await expect(page.getByTestId("meaning-headline")).toHaveText("refrigerator");
    await expect(page.getByTestId("meaning-type")).toHaveCount(0);
    await expect.poll(() => sent.some((b) => b.meaning === "refrigerator")).toBe(true);
    expect(sent.some((b) => "partOfSpeech" in b)).toBe(false);
  });

  test("picking another meaning doesn't send the type again", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["will go", "go"], source: "sentence",
      wordType: { partOfSpeech: "verb", form: null, lemma: null } });
    const sent = vocabularyWrites(page);
    await openWord(page, created);
    await expect(page.getByTestId("meaning-type")).toHaveText("verb");
    await expect.poll(() => sent.some((b) => b.partOfSpeech === "verb")).toBe(true);
    const before = sent.length;
    await page.getByTestId("meaning-also").getByRole("button", { name: "go", exact: true }).click();
    await expect.poll(() => sent.length).toBeGreaterThan(before);
    expect(sent.slice(before).some((b) => "partOfSpeech" in b)).toBe(false);
  });

  test("a meaning picked in one sentence leads when the word is reopened in another", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}. ${w(3)} ${w(1)}.`);
    await lookupAnswer(page, created, { meanings: ["standing", "upright"], source: "sentence" });
    vocabularyWrites(page);
    await openReader(page, `/read/${created.id}`);
    const copies = article(page).getByText(created.word(1), { exact: true });
    const headline = page.getByTestId("meaning-headline");
    await copies.nth(1).click();
    await expect(headline).toHaveText("standing");
    await popupClose(page).click();

    await copies.nth(0).click();
    await page.getByTestId("meaning-also").getByRole("button", { name: "upright" }).click();
    await expect(headline).toHaveText("upright");
    await popupClose(page).click();

    await copies.nth(1).click();
    await expect(headline).toHaveText("upright");
  });

  test("asks again when the same word is clicked in another sentence", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}. ${w(3)} ${w(1)}.`);
    const asked: URLSearchParams[] = [];
    await page.route("**/api/dictionary?*", (route) => {
      const params = new URL(route.request().url()).searchParams;
      asked.push(params);
      const meaning = params.get("before") ? "get up" : "standing";
      return route.fulfill({ json: { term: created!.word(1), language: created!.language, meaningLanguage: "en", meanings: [meaning], source: "sentence" } });
    });
    await openReader(page, `/read/${created.id}`);
    const copies = article(page).getByText(created.word(1), { exact: true });
    await copies.nth(0).click();
    await expect(page.getByTestId("meanings")).toContainText("standing");
    await popupClose(page).click();

    await copies.nth(1).click();
    await expect(page.getByTestId("meanings")).toContainText("get up");
    expect(asked).toHaveLength(2);
    expect(asked[1].get("before")).toBe(`${created.word(3)} `);
  });

  test("shows no dictionary definitions, and the AI explains only when asked", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["house"], source: "sentence" });
    let explained = 0;
    await page.route("**/api/dictionary/explain?*", (route) => {
      explained += 1;
      return route.fulfill({ json: {
        term: created!.word(1), language: created!.language, found: true, pronunciation: null, lemma: null, source: "AI", sourceUrl: null,
        senses: [{ partOfSpeech: "noun", definition: "a building people live in", examples: ["La casa es grande."] }],
      } });
    });
    await openWord(page, created);
    await expect(page.getByTestId("meanings")).toContainText("house");
    await expect(page.getByText(/form of|Source:/)).toHaveCount(0);
    await expect(page.getByTestId("ai-explanation")).toHaveCount(0);
    expect(explained).toBe(0);

    await page.getByRole("button", { name: "Explain with AI" }).click();
    await expect(page.getByTestId("ai-explanation")).toContainText("a building people live in");
    await expect(page.getByTestId("ai-explanation")).toContainText("La casa es grande.");
    expect(explained).toBe(1);
  });
});

test("the Words page edits and clears a word's own-language meaning", async ({ page }) => {
  await page.goto("/library");
  const term = `zqmeaning${Date.now().toString(36)}`;
  const res = await page.request.post("/api/vocabulary", { data: { language: "es", term, status: "learning", definition: "dog", meaning: "perro" } });
  expect(res.ok()).toBe(true);
  const id = (await res.json()).id as number;
  try {
    await page.goto("/vocabulary");
    await page.getByPlaceholder("Search words or definitions…").fill(term);
    await page.getByPlaceholder("Search words or definitions…").press("Enter");
    const row = page.getByRole("listitem").filter({ has: page.getByText(term, { exact: true }) });
    const meaning = row.getByTestId("word-meaning");
    await expect(meaning).toContainText("perro");

    await meaning.getByRole("button", { name: /perro/ }).click();
    await row.getByLabel("Meaning").fill("perro (animal)");
    await row.getByRole("button", { name: "Save meaning" }).click();
    await expect(meaning).toContainText("perro (animal)");
    expect((await (await page.request.get(`/api/vocabulary/${id}`)).json()).meaning).toBe("perro (animal)");

    await meaning.getByRole("button", { name: /perro \(animal\)/ }).click();
    await row.getByLabel("Meaning").fill("");
    await row.getByRole("button", { name: "Save meaning" }).click();
    await expect.poll(async () => (await (await page.request.get(`/api/vocabulary/${id}`)).json()).meaning).toBeUndefined();
  } finally {
    await page.request.delete(`/api/vocabulary/${id}`);
  }
});
