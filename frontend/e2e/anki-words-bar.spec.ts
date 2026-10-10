import { devices, expect, test } from "@playwright/test";
import { mature, statusOf, young } from "./anki-helpers";
import { bar, changesSummary, connectDecks, deck, newLearner, openAllWords, saveWord, syncNow, wordRow } from "./anki-words-helpers";

test("the Words bar says when Anki synced and syncs next; Sync now runs it and reloads the words", async ({ browser }) => {
  test.slow();
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(91, [mature({ Word: "barcasa" }), young({ Word: "barperro" })])];
    await connectDecks(page, [{ id: 91, synced: true }]);
    await saveWord(page, "barcasa");
    await page.clock.install();
    await openAllWords(page);

    await expect(bar(page)).toContainText("Anki · synced just now · next sync in 15 min", { timeout: 30_000 });
    await expect(wordRow(page, "barperro")).toBeVisible();
    const changes = bar(page).getByTestId("anki-changes");
    await expect(changesSummary(page)).toHaveText("1 word now known, 1 added");
    await changesSummary(page).click();
    await expect(changes).toContainText("1 of your words became known");
    await changes.getByTestId("anki-became_known").locator("summary").click();
    await expect(changes.getByTestId("anki-became_known").getByTestId("anki-words")).toHaveText("barcasa");

    await page.clock.fastForward("04:00");
    await expect(bar(page)).toContainText("synced 4 min ago · next sync in 11 min");

    anki.decks[0].cards.push(mature({ Word: "bargato" }));
    anki.cardsInfoDelayMs = 1500;
    await syncNow(page).click();
    await expect(bar(page).getByRole("status")).toContainText("Syncing with Anki…");
    await expect(syncNow(page)).toBeDisabled();
    await expect(bar(page)).toContainText("synced just now · next sync in 15 min", { timeout: 30_000 });
    await expect(wordRow(page, "bargato")).toBeVisible();
    await expect(changesSummary(page)).toHaveText("1 word added");

    await page.getByRole("group", { name: "Vocabulary section" }).getByRole("button", { name: "Phrases" }).click();
    await expect(bar(page)).toContainText("synced just now");
  } finally {
    await context.close();
  }
});

test("the automatic sync every 15 minutes shows on the bar and reloads the words", async ({ browser }) => {
  test.slow();
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(92, [mature({ Word: "autouno" })])];
    await connectDecks(page, [{ id: 92, synced: true }]);
    await page.clock.install();
    await openAllWords(page);
    await expect(bar(page)).toContainText("synced just now", { timeout: 30_000 });
    await expect(wordRow(page, "autouno")).toBeVisible();

    anki.decks[0].cards.push(mature({ Word: "autodos" }));
    await page.clock.fastForward("10:00");
    await expect(bar(page)).toContainText("synced 10 min ago · next sync in 5 min");
    await page.clock.fastForward("05:00");
    await expect(wordRow(page, "autodos")).toBeVisible({ timeout: 30_000 });
    await expect(bar(page)).toContainText("synced just now · next sync in 15 min");
  } finally {
    await context.close();
  }
});

test("a sync that changed nothing shows no changes", async ({ browser }) => {
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(93, [])];
    await connectDecks(page, [{ id: 93, synced: true }]);
    await openAllWords(page);
    await expect(bar(page)).toContainText("synced just now", { timeout: 30_000 });
    await expect(bar(page).getByTestId("anki-changes")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("when Anki desktop isn't open, the bar says so, keeps the last sync, and Sync now tries again", async ({ browser }) => {
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(94, [mature({ Word: "cerrado" })])];
    anki.closed = true;
    await connectDecks(page, [{ id: 94, synced: true }]);
    await openAllWords(page);
    await expect(bar(page)).toContainText("Anki isn't open. Open Anki desktop and it'll sync within 15 min", { timeout: 30_000 });
    await expect(bar(page)).toContainText("Last synced just now");
    await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);

    anki.closed = false;
    await syncNow(page).click();
    await expect(wordRow(page, "cerrado")).toBeVisible({ timeout: 30_000 });
    await expect(bar(page)).not.toContainText("isn't open");
  } finally {
    await context.close();
  }
});

test("Sync now reads a big collection in batches, showing its progress", async ({ browser }) => {
  test.slow();
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(95, Array.from({ length: 1200 }, (_, i) => mature({ Word: `grande${i}` })))];
    anki.closed = true;
    await connectDecks(page, [{ id: 95, synced: true }]);
    await openAllWords(page);
    await expect(bar(page)).toContainText("isn't open", { timeout: 30_000 });
    anki.closed = false;
    anki.cardsInfoDelayMs = 400;
    await syncNow(page).click();
    await expect(bar(page).getByRole("status")).toContainText("/ 1200");
    await expect(syncNow(page)).toBeEnabled({ timeout: 30_000 });
    expect(anki.calls.filter((c) => c.action === "cardsInfo").length).toBe(3);
    await expect(changesSummary(page)).toHaveText("1200 words added");
    expect(await statusOf(page, "es", "grande1199")).toBe("known");
  } finally {
    await context.close();
  }
});

test("when Anki closes in the middle of a sync, the bar says the next sync carries on", async ({ browser }) => {
  test.slow();
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(96, Array.from({ length: 700 }, (_, i) => mature({ Word: `medio${i}` })))];
    anki.closed = true;
    await connectDecks(page, [{ id: 96, synced: true }]);
    await openAllWords(page);
    await expect(bar(page)).toContainText("isn't open", { timeout: 30_000 });
    anki.closed = false;
    anki.closeAfterCardsInfo = 1;
    await syncNow(page).click();
    await expect(bar(page)).toContainText("Sync stopped: Anki closed. The next sync carries on.", { timeout: 30_000 });
    expect(await statusOf(page, "es", "medio0")).toBe("known");
    expect(await statusOf(page, "es", "medio699")).toBeNull();
    anki.closed = false;
    anki.closeAfterCardsInfo = null;
    await syncNow(page).click();
    await expect(bar(page)).toContainText("synced just now", { timeout: 30_000 });
    await expect(bar(page)).not.toContainText("Sync stopped");
    expect(await statusOf(page, "es", "medio699")).toBe("known");
  } finally {
    await context.close();
  }
});

test("when another tab is already syncing, Sync now says to try again in a moment", async ({ browser }) => {
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(97, [])];
    await connectDecks(page, [{ id: 97, synced: true }]);
    const other = (await (await page.request.post("/api/anki/runs", { data: { dryRun: false } })).json()) as { id: number };
    await openAllWords(page);
    await expect(syncNow(page)).toBeEnabled({ timeout: 30_000 });
    await syncNow(page).click();
    await expect(bar(page)).toContainText("A sync is already running, perhaps in another tab. Try again in a moment.");
    await page.request.post(`/api/anki/runs/${other.id}/stop`);
  } finally {
    await context.close();
  }
});

test("on a phone the bar says Anki syncs from the computer, with no Sync now", async ({ browser }) => {
  const { context, page, anki } = await newLearner(browser, devices["Pixel 5"]);
  try {
    anki.decks = [deck(98, [mature({ Word: "movil" })])];
    await connectDecks(page, [{ id: 98, synced: true }]);
    await openAllWords(page);
    await expect(bar(page)).toHaveText("Anki syncs from your computer · last synced just now");
    await expect(syncNow(page)).toHaveCount(0);
    expect(anki.calls).toEqual([]);
  } finally {
    await context.close();
  }
});

test("before a deck's first sync, the bar sends me to Settings; after it, new decks wait there", async ({ browser }) => {
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [deck(99, [mature({ Word: "primero" })]), deck(100, [mature({ Word: "nuevo" })])];
    await connectDecks(page, [{ id: 99, synced: false }]);
    await openAllWords(page);
    await expect(bar(page)).toContainText("Preview and run your first Anki sync in Settings → Anki");
    await expect(bar(page).getByRole("link", { name: "Settings → Anki" })).toHaveAttribute("href", "/settings/anki");
    await expect(syncNow(page)).toHaveCount(0);

    await connectDecks(page, [{ id: 99, synced: true }, { id: 100, synced: false }]);
    await openAllWords(page);
    await expect(bar(page)).toContainText("A new deck needs its first sync in Settings → Anki");
    await syncNow(page).click();
    await expect(wordRow(page, "primero")).toBeVisible({ timeout: 30_000 });
    await expect(wordRow(page, "nuevo")).toHaveCount(0);
    expect(anki.calls.some((c) => c.action === "findCards" && String(c.params.query).includes("did:100"))).toBe(false);
  } finally {
    await context.close();
  }
});

test("without Anki, a line offers to connect it until I hide it; never on a phone", async ({ browser }) => {
  const { context, page } = await newLearner(browser);
  const phone = await newLearner(browser, devices["Pixel 5"]);
  try {
    await openAllWords(page);
    const offer = page.getByTestId("anki-offer");
    await expect(offer).toContainText("Review in Anki?");
    await expect(offer.getByRole("link", { name: "Connect it" })).toHaveAttribute("href", "/settings/anki");
    await expect(bar(page)).toHaveCount(0);
    await offer.getByRole("button", { name: "Hide" }).click();
    await expect(offer).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Vocabulary" })).toBeVisible();
    await expect(page.getByTestId("anki-offer")).toHaveCount(0);

    await phone.page.goto("/vocabulary");
    await expect(phone.page.getByRole("heading", { name: "Vocabulary" })).toBeVisible();
    await expect(phone.page.getByTestId("anki-offer")).toHaveCount(0);
  } finally {
    await context.close();
    await phone.context.close();
  }
});
