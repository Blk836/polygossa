import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, type Created } from "./reader-helpers";

// docs/acceptance/lingq-style-lookup.feature and word-translations.feature: the word popup's meaning line, dictionary
// links and AI explanation, and the own-language meaning a saved word keeps. Lookups are answered in the browser: the
// e2e backend has no machine translation. The shared test account's native language is English (every feature on).

function lookupAnswer(page: Page, created: Created, extra: Record<string, unknown>) {
  return page.route("**/api/dictionary?*", (route) =>
    route.fulfill({ json: { term: created.word(1), language: created.language, meaningLanguage: "en", ...extra } }),
  );
}

/** The bodies of every vocabulary write the page sends. */
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

  test("shows meanings other learners saved, saves the first, and a click picks another", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["home", "house"], source: "community" });
    const sent = vocabularyWrites(page);
    await openWord(page, created);

    const line = page.getByTestId("meanings");
    await expect(line).toContainText("English");
    await expect(line).toContainText("home, house");
    await expect(line).toContainText("saved by other learners");
    await expect(line.getByRole("button", { name: "home" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => sent.some((b) => b.meaning === "home" && b.definition === "home")).toBe(true);

    await line.getByRole("button", { name: "house" }).click();
    await expect(line.getByRole("button", { name: "house" })).toHaveAttribute("aria-pressed", "true");
    await expect(line.getByRole("button", { name: "home" })).toHaveAttribute("aria-pressed", "false");
    const word = created.word(1);
    await expect.poll(async () => (await (await page.request.get(`/api/vocabulary?q=${word}`)).json()).items
      .filter((e: { term: string }) => e.term === word)
      .map((e: { meaning?: string; definition?: string }) => `${e.meaning}/${e.definition}`))
      .toEqual(["house/house"]);
  });

  test("labels a machine translation and links out to dictionaries in a new tab", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["refrigerator"], source: "machine" });
    await openWord(page, created);

    await expect(page.getByTestId("meanings")).toContainText("refrigerator");
    await expect(page.getByTestId("meanings")).toContainText("machine translation");
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
    await expect(page.getByTestId("dictionary-links").getByRole("link")).toHaveCount(3);
  });

  // translation-in-context.feature: the lookup carries the text around the copy clicked, for an echoed word.
  test("sends the text around the clicked copy of the word with its lookup", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(2)} ${w(1)} ${w(3)} ${w(1)} ${w(4)}.`);
    const asked: URLSearchParams[] = [];
    await page.route("**/api/dictionary?*", (route) => {
      asked.push(new URL(route.request().url()).searchParams);
      return route.fulfill({ json: { term: created!.word(1), language: created!.language, meaningLanguage: "en", meanings: ["limping"], source: "machine" } });
    });
    await openReader(page, `/read/${created.id}`);
    await article(page).getByText(created.word(1), { exact: true }).nth(1).click();

    await expect(page.getByTestId("meanings")).toContainText("limping");
    expect(asked).toHaveLength(1);
    expect(asked[0].get("term")).toBe(created.word(1));
    expect(asked[0].get("before")).toBe(`${created.word(2)} ${created.word(1)} ${created.word(3)} `);
    expect(asked[0].get("after")).toBe(` ${created.word(4)}.`);
  });

  test("shows no dictionary definitions, and the AI explains only when asked", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { meanings: ["house"], source: "machine" });
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
  await page.goto("/library"); // signs in
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
