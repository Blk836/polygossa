import { expect, test, type Page } from "@playwright/test";
import { article, cleanUp, createTextWith, openReader, type Created } from "./reader-helpers";

// docs/acceptance/word-translations.feature: meanings other learners saved and machine translations in the word
// popup, and the own-language meaning a saved word keeps. The lookups are answered in the browser: the e2e backend
// has no machine translation and the shared test account's native language is English.

function lookupAnswer(page: Page, created: Created, extra: Record<string, unknown>) {
  const term = created.word(1);
  return page.route("**/api/dictionary?*", (route) =>
    route.fulfill({
      json: {
        term, language: created.language, found: true, pronunciation: null, lemma: null, source: "Free Dictionary API (Wiktionary)", sourceUrl: null,
        senses: [{ partOfSpeech: "noun", definition: "dog", examples: [] }],
        translationLanguage: "es",
        ...extra,
      },
    }),
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

test.describe("the word popup", () => {
  let created: Created | null = null;
  test.afterEach(async ({ page }) => {
    await cleanUp(page, created);
    created = null;
  });

  test("shows meanings other learners saved, saves the first, and a click picks another", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { translations: ["perro", "can"], translationSource: "community" });
    const sent = vocabularyWrites(page);
    await openReader(page, `/read/${created.id}`);
    await article(page).getByText(created.word(1), { exact: true }).click();

    const line = page.getByTestId("translations");
    await expect(line).toContainText("Spanish");
    await expect(line).toContainText("saved by other learners");
    await expect(line.getByRole("button", { name: "perro" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => sent.some((b) => b.meaning === "perro" && b.definition === "perro, can — dog")).toBe(true);

    await line.getByRole("button", { name: "can" }).click();
    await expect(line.getByRole("button", { name: "can" })).toHaveAttribute("aria-pressed", "true");
    await expect(line.getByRole("button", { name: "perro" })).toHaveAttribute("aria-pressed", "false");
    await expect.poll(() => sent.some((b) => b.meaning === "can")).toBe(true);
    const word = created.word(1);
    await expect.poll(async () => (await (await page.request.get(`/api/vocabulary?q=${word}`)).json()).items
      .filter((e: { term: string }) => e.term === word).map((e: { meaning?: string }) => e.meaning)).toEqual(["can"]);
  });

  test("labels a machine translation, also for a word no dictionary has", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { found: false, senses: [], source: null, translations: ["refrigerador"], translationSource: "machine" });
    const sent = vocabularyWrites(page);
    await openReader(page, `/read/${created.id}`);
    await article(page).getByText(created.word(1), { exact: true }).click();

    const line = page.getByTestId("translations");
    await expect(line).toContainText("refrigerador");
    await expect(line).toContainText("machine translation");
    await expect(page.getByText("No dictionary entry found")).toBeVisible();
    await expect.poll(() => sent.some((b) => b.meaning === "refrigerador")).toBe(true);
  });

  test("the dictionary's own translations carry no note", async ({ page }) => {
    created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
    await lookupAnswer(page, created, { translations: ["perro"], translationSource: "dictionary" });
    await openReader(page, `/read/${created.id}`);
    await article(page).getByText(created.word(1), { exact: true }).click();
    const line = page.getByTestId("translations");
    await expect(line).toContainText("perro");
    await expect(line).not.toContainText("saved by other learners");
    await expect(line).not.toContainText("machine translation");
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
