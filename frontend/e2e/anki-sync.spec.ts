import { expect, test, type Page } from "@playwright/test";
import { chooseDecks, cleanUpPrefix, FakeAnki, mature, modelOf, myLanguage, stamp, statusOf, syncByApi, young } from "./anki-helpers";
import { cleanUp, createTextWith, openReader, wordAt } from "./reader-helpers";

test.describe.configure({ mode: "serial" });

const syncGroup = (page: Page) => page.getByRole("group", { name: "Sync with Anki" });
const connectGroup = (page: Page) => page.getByRole("group", { name: "Connect to Anki" });

async function latestRunId(page: Page): Promise<number> {
  const res = await page.request.get("/api/anki/runs/latest");
  return res.status() === 204 ? 0 : ((await res.json()) as { id: number }).id;
}

test("choosing a deck, previewing what it will change, then syncing", async ({ page }) => {
  const s = stamp();
  const language = await myLanguage(page);
  const anki = new FakeAnki();
  anki.decks = [{ id: 81, name: `Deck ${s}`, cards: [mature({ Front: `${s}uno` }), young({ Front: `${s}dos` }), mature({ Front: "" }), mature({ Front: `${s}tres` })] }];
  try {
    await anki.install(page);
    await page.request.post("/api/vocabulary", { data: { language, term: `${s}tres`, status: "learning" } });
    await page.goto("/settings/anki");
    await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
    await connectGroup(page).getByTestId("anki-deck").filter({ hasText: `Deck ${s}` }).getByRole("checkbox").check();
    await connectGroup(page).getByRole("button", { name: "Save decks" }).click();
    await expect(connectGroup(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    await syncGroup(page).getByRole("button", { name: "Preview" }).click();

    const preview = syncGroup(page).getByTestId("anki-preview");
    await expect(preview).toContainText("4 cards read from Anki. Nothing has changed yet.");
    await expect(preview).toContainText("1 of your words will become known");
    await expect(preview).toContainText("1 word will be added as known");
    await expect(preview).toContainText("1 word will be added as learning");
    await expect(preview).toContainText("1 card will be skipped: the word field is empty");
    await expect(preview).toContainText("1 word will leave the Review tab here");
    await expect(preview).toContainText("not as words learned this week");
    await preview.getByTestId("anki-became_known").locator("summary").click();
    await expect(preview.getByTestId("anki-became_known").getByTestId("anki-words")).toHaveText(`${s}tres`);
    expect(await statusOf(page, language, `${s}uno`)).toBeNull();
    expect(await statusOf(page, language, `${s}tres`)).toBe("learning");

    await syncGroup(page).getByRole("button", { name: "Start syncing" }).click();
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("Last synced", { timeout: 30_000 });
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("1 of your words became known");
    expect(await statusOf(page, language, `${s}uno`)).toBe("known");
    expect(await statusOf(page, language, `${s}dos`)).toBe("learning");
    expect(await statusOf(page, language, `${s}tres`)).toBe("known");
    await expect(syncGroup(page).getByRole("link", { name: "Practice → Words" })).toBeVisible();
    await expect(page.getByTestId("anki-how-it-works").locator("summary")).toHaveText("How it works");
    await expect(page.getByTestId("anki-how-it-works")).not.toHaveAttribute("open");

    await syncGroup(page).getByRole("button", { name: "Preview" }).click();
    await expect(syncGroup(page).getByTestId("anki-preview")).toContainText("Nothing has changed yet.");
    await connectGroup(page).getByTestId("anki-note-type").getByRole("checkbox", { name: "Skip these cards" }).check();
    await connectGroup(page).getByRole("button", { name: "Save decks" }).click();
    await expect(syncGroup(page).getByTestId("anki-preview")).toHaveCount(0);
    await expect(syncGroup(page).getByRole("link", { name: "Practice → Words" })).toBeVisible();
    await syncGroup(page).getByRole("button", { name: "Preview" }).click();
    await expect(syncGroup(page).getByTestId("anki-left-out-skipped")).toHaveText("4 cards left out: their note type is set to skip.", { timeout: 30_000 });
    await expect(syncGroup(page).getByRole("button", { name: "Start syncing" })).toBeVisible();
  } finally {
    await cleanUpPrefix(page, language, s);
  }
});

test("a sync runs on its own when the app opens, for decks synced before", async ({ page }) => {
  const s = stamp();
  const language = await myLanguage(page);
  const anki = new FakeAnki();
  anki.decks = [{ id: 84, name: `Auto ${s}`, cards: [mature({ Word: `${s}auto` })] }];
  try {
    await chooseDecks(page, [{ ankiDeckId: 84, name: `Auto ${s}`, language, wordField: "Word" }]);
    const first = await syncByApi(page, 84, []);
    await anki.install(page);
    await page.goto("/library");
    await expect.poll(() => latestRunId(page), { timeout: 30_000 }).toBeGreaterThan(first);
    await expect.poll(() => statusOf(page, language, `${s}auto`), { timeout: 30_000 }).toBe("known");
  } finally {
    await cleanUpPrefix(page, language, s);
  }
});

test("the word popup says when a word is known through Anki, and that a change of mine sticks", async ({ page }) => {
  const created = await createTextWith(page, (w) => `${w(1)} ${w(2)}.`);
  const word = created.word(1);
  try {
    await chooseDecks(page, [{ ankiDeckId: 85, name: "Popup", language: created.language, wordField: "Word" }]);
    await syncByApi(page, 85, [{ word, type: 2, interval: 30 }]);
    await openReader(page, `/read/${created.id}`);
    await wordAt(page, 0).click();
    await expect(page.getByTestId("anki-note")).toHaveText("Known through Anki");
    await page.getByRole("button", { name: "Learning", exact: true }).click();
    await expect(page.getByTestId("anki-note")).toHaveText("Anki won't change this back until its card changes in Anki.");
  } finally {
    await page.request.delete("/api/anki/decks");
    await cleanUp(page, created);
  }
});

test("the Review tab says how many words are reviewed in Anki", async ({ page }) => {
  const s = stamp();
  const language = await myLanguage(page);
  try {
    await page.request.post("/api/vocabulary", { data: { language, term: `${s}rev`, status: "learning" } });
    await chooseDecks(page, [{ ankiDeckId: 86, name: "Review", language, wordField: "Word" }]);
    await syncByApi(page, 86, [{ word: `${s}rev`, type: 2, interval: 3 }]);
    await page.goto("/review");
    const note = page.getByTestId("words-in-anki");
    await expect(note).toContainText("reviewed in Anki, so");
    await expect(note.getByRole("link", { name: "Anki sync" })).toHaveAttribute("href", "/vocabulary");
  } finally {
    await cleanUpPrefix(page, language, s);
  }
});

test("a mixed deck syncs each note type with its own field, and leaves skipped ones out", async ({ page }) => {
  const s = stamp();
  const language = await myLanguage(page);
  const anki = new FakeAnki();
  anki.decks = [{ id: 88, name: `Mixed ${s}`, cards: [
    mature({ Front: "dog", Back: `${s}perro` }),
    { ...mature({ Sentence: "x", Word: `${s}ladrar` }), model: `Sentences ${s}` },
    { ...mature({ Text: `{{c1::${s}come}}`, Extra: "" }), model: `Cloze ${s}` },
    { ...mature({ Text: `{{c1::${s}bebe}}`, Extra: "" }), model: `Cloze ${s}` },
  ] }];
  try {
    await anki.install(page);
    await page.goto("/settings/anki");
    await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
    await connectGroup(page).getByTestId("anki-deck").filter({ hasText: `Mixed ${s}` }).getByRole("checkbox").check();
    const basic = connectGroup(page).getByTestId("anki-note-type").filter({ hasText: "Front+Back" });
    await basic.getByLabel("Word field", { exact: true }).selectOption("Back");
    await connectGroup(page).getByRole("button", { name: "Save decks" }).click();
    await expect(connectGroup(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
    const saved = (await (await page.request.get("/api/anki/decks")).json()).decks[0];
    expect(saved.noteTypes.map((t: { name: string; wordField?: string }) => [t.name, t.wordField ?? null]).sort())
      .toEqual([["Front+Back", "Back"], [`Cloze ${s}`, null], [`Sentences ${s}`, "Word"]].sort());
    await syncGroup(page).getByRole("button", { name: "Preview" }).click();
    const preview = syncGroup(page).getByTestId("anki-preview");
    await expect(preview).toContainText("2 cards read from Anki");
    await expect(preview.getByTestId("anki-left-out-skipped")).toHaveText("2 cards left out: their note type is set to skip.");
    await syncGroup(page).getByRole("button", { name: "Start syncing" }).click();
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("Last synced", { timeout: 30_000 });
    expect(await statusOf(page, language, `${s}perro`)).toBe("known");
    expect(await statusOf(page, language, `${s}ladrar`)).toBe("known");
    expect(await statusOf(page, language, "dog")).toBeNull();
  } finally {
    await cleanUpPrefix(page, language, s);
  }
});

test("a note type added to a deck later waits until I check its word field", async ({ page }) => {
  const s = stamp();
  const language = await myLanguage(page);
  const anki = new FakeAnki();
  anki.decks = [{ id: 89, name: `Growing ${s}`, cards: [mature({ Word: `${s}uno` }), { ...mature({ Vocab: `${s}dos` }), model: `Later ${s}` }] }];
  try {
    await anki.install(page);
    const basicId = modelOf(mature({ Word: "" })).id;
    await chooseDecks(page, [{ ankiDeckId: 89, name: `Growing ${s}`, language, wordField: "Word", noteTypes: [{ modelId: basicId, name: "Word", wordField: "Word" }] }]);
    await page.goto("/settings/anki");
    await expect(connectGroup(page).getByRole("status")).toHaveText("Connected to Anki");
    const later = connectGroup(page).getByTestId("anki-note-type").filter({ hasText: `Later ${s}` });
    await expect(later).toContainText("New: check its word field");
    await syncGroup(page).getByRole("button", { name: "Preview" }).click();
    await expect(syncGroup(page).getByTestId("anki-left-out-waiting")).toHaveText("1 card waiting: a new note type needs its word field checked.");
    await syncGroup(page).getByRole("button", { name: "Start syncing" }).click();
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("Last synced", { timeout: 30_000 });
    expect(await statusOf(page, language, `${s}uno`)).toBe("known");
    expect(await statusOf(page, language, `${s}dos`)).toBeNull();
  } finally {
    await cleanUpPrefix(page, language, s);
  }
});

test("disconnecting forgets my decks", async ({ page }) => {
  const language = await myLanguage(page);
  await chooseDecks(page, [{ ankiDeckId: 87, name: "Gone", language, wordField: "Word" }]);
  await page.goto("/settings/anki");
  await syncGroup(page).getByRole("button", { name: "Disconnect Anki" }).click();
  await expect(syncGroup(page)).toHaveCount(0);
  expect((await (await page.request.get("/api/anki/decks")).json()).decks).toEqual([]);
  expect((await (await page.request.get("/api/me")).json()).ankiConnected).toBe(false);
});
