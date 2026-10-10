import { expect, test, type Page } from "@playwright/test";
import { chooseDecks, cleanUpPrefix, deleteWords, FakeAnki, mature, myLanguage, stamp, statusOf, syncByApi, young } from "./anki-helpers";
import { cleanUp, createTextWith, openReader, wordAt } from "./reader-helpers";

test.describe.configure({ mode: "serial" });

const syncGroup = (page: Page) => page.getByRole("group", { name: "Sync with Anki" });
const connectGroup = (page: Page) => page.getByRole("group", { name: "Connect to Anki" });
const findCalls = (anki: FakeAnki, deck: number) => anki.calls.filter((c) => c.action === "findCards" && c.params.query === `did:${deck}`);

async function latestRunId(page: Page): Promise<number> {
  const res = await page.request.get("/api/anki/runs/latest");
  return res.status() === 204 ? 0 : ((await res.json()) as { id: number }).id;
}

async function waitForAutoSync(page: Page, anki: FakeAnki, deck: number, after: number) {
  await expect.poll(() => findCalls(anki, deck).length).toBeGreaterThan(0);
  await expect.poll(async () => {
    const res = await page.request.get("/api/anki/runs/latest");
    const run = res.status() === 204 ? null : ((await res.json()) as { id: number; state: string });
    return run && run.id > after ? run.state : "waiting";
  }, { timeout: 30_000 }).toBe("done");
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
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("Last synced");
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("1 of your words became known");
    expect(await statusOf(page, language, `${s}uno`)).toBe("known");
    expect(await statusOf(page, language, `${s}dos`)).toBe("learning");
    expect(await statusOf(page, language, `${s}tres`)).toBe("known");
    await expect(syncGroup(page).getByRole("button", { name: "Sync now" })).toBeVisible();
    await expect(page.getByTestId("anki-how-it-works").locator("summary")).toHaveText("How it works");
    await expect(page.getByTestId("anki-how-it-works")).not.toHaveAttribute("open");
  } finally {
    await cleanUpPrefix(page, language, s);
  }
});

test("Sync now reads a big collection in batches, showing its progress", async ({ page }) => {
  const s = stamp();
  const language = await myLanguage(page);
  const anki = new FakeAnki();
  anki.decks = [{ id: 82, name: `Big ${s}`, cards: Array.from({ length: 1200 }, (_, i) => mature({ Word: `${s}w${i}` })) }];
  try {
    await chooseDecks(page, [{ ankiDeckId: 82, name: `Big ${s}`, language, wordField: "Word" }]);
    const first = await syncByApi(page, 82, []);
    await anki.install(page);
    await page.goto("/settings/anki");
    await waitForAutoSync(page, anki, 82, first);
    const before = anki.calls.filter((c) => c.action === "cardsInfo").length;
    anki.cardsInfoDelayMs = 400;
    await syncGroup(page).getByRole("button", { name: "Sync now" }).click();
    await expect(syncGroup(page).getByRole("status")).toContainText("of 1200");
    await expect(syncGroup(page).getByRole("button", { name: "Sync now" })).toBeEnabled({ timeout: 30_000 });
    expect(anki.calls.filter((c) => c.action === "cardsInfo").length - before).toBe(3);
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("1200 cards read");
    expect(await statusOf(page, language, `${s}w1199`)).toBe("known");
  } finally {
    await cleanUpPrefix(page, language, s);
  }
});

test("when Anki closes in the middle of a sync, what was sent is kept and the next sync carries on", async ({ page }) => {
  const s = stamp();
  const language = await myLanguage(page);
  const anki = new FakeAnki();
  anki.decks = [{ id: 83, name: `Closing ${s}`, cards: Array.from({ length: 700 }, (_, i) => young({ Word: `${s}c${i}` })) }];
  try {
    await chooseDecks(page, [{ ankiDeckId: 83, name: `Closing ${s}`, language, wordField: "Word" }]);
    const first = await syncByApi(page, 83, []);
    await anki.install(page);
    await page.goto("/settings/anki");
    await waitForAutoSync(page, anki, 83, first);
    await deleteWords(page, language, s);
    anki.closeAfterCardsInfo = 1;
    await syncGroup(page).getByRole("button", { name: "Sync now" }).click();
    await expect(syncGroup(page).getByTestId("anki-result").getByRole("alert")).toHaveText("Sync stopped: Anki closed. The next sync carries on.");
    expect(await statusOf(page, language, `${s}c0`)).toBe("learning");
    expect(await statusOf(page, language, `${s}c699`)).toBeNull();
    anki.closed = false;
    anki.closeAfterCardsInfo = null;
    await syncGroup(page).getByRole("button", { name: "Sync now" }).click();
    await expect(syncGroup(page).getByTestId("anki-result")).toContainText("Last synced");
    expect(await statusOf(page, language, `${s}c699`)).toBe("learning");
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
    expect((await page.request.post("/api/me/plan", { data: { tier: "PRO" } })).ok()).toBe(true);
    await page.request.post("/api/vocabulary", { data: { language, term: `${s}rev`, status: "learning" } });
    await chooseDecks(page, [{ ankiDeckId: 86, name: "Review", language, wordField: "Word" }]);
    await syncByApi(page, 86, [{ word: `${s}rev`, type: 2, interval: 3 }]);
    await page.goto("/review");
    const note = page.getByTestId("words-in-anki");
    await expect(note).toContainText("reviewed in Anki, so");
    await expect(note.getByRole("link", { name: "Anki settings" })).toHaveAttribute("href", "/settings/anki");
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
