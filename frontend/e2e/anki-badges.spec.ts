import { expect, test } from "@playwright/test";
import { mature, young } from "./anki-helpers";
import { bar, connectDecks, deck, newLearner, openAllWords, saveWord, wordRow } from "./anki-words-helpers";

test("words with an Anki card show a badge saying what state the card is in", async ({ browser }) => {
  const { context, page, anki } = await newLearner(browser);
  try {
    for (const term of ["badgato", "badcasa", "badmesa"]) await saveWord(page, term);
    anki.decks = [deck(61, [mature({ Word: "badcasa" }), young({ Word: "badperro" }), { fields: { Word: "badgato" }, type: 0, interval: 0 }])];
    await connectDecks(page, [{ id: 61, synced: true }]);
    await openAllWords(page);
    await expect(bar(page)).toContainText("next sync in 15 min", { timeout: 30_000 });

    const expected: [string, string][] = [
      ["badcasa", "In Anki: mature card (next review 21+ days). Known through Anki"],
      ["badperro", "In Anki: being learned"],
      ["badgato", "In Anki: not reviewed yet"],
    ];
    for (const [term, text] of expected) {
      const badge = wordRow(page, term).getByTestId("anki-badge");
      await expect(badge).toHaveText(/^Anki/);
      await badge.hover();
      await expect(wordRow(page, term).getByRole("tooltip")).toHaveText(text);
    }
    const focused = wordRow(page, "badperro").getByTestId("anki-badge");
    await page.mouse.move(0, 0);
    await focused.focus();
    await expect(wordRow(page, "badperro").getByRole("tooltip")).toBeVisible();
    await expect(wordRow(page, "badmesa").getByTestId("anki-badge")).toHaveCount(0);

    await page.goto("/settings/anki");
    await page.getByRole("button", { name: "Disconnect Anki" }).click();
    await expect(page.getByRole("group", { name: "Sync with Anki" })).toHaveCount(0);
    await openAllWords(page);
    await expect(wordRow(page, "badcasa")).toBeVisible();
    await expect(page.getByTestId("anki-badge")).toHaveCount(0);
    await expect(bar(page)).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("Settings → Anki shows the same last sync and sends day-to-day syncing to Words", async ({ browser }) => {
  const { context, page, anki } = await newLearner(browser);
  try {
    anki.decks = [{ id: 63, name: "Deck 63", cards: [] }];
    await connectDecks(page, [{ id: 63, synced: true }]);
    await page.clock.install();
    await page.goto("/settings/anki");
    const sync = page.getByRole("group", { name: "Sync with Anki" });
    await expect(sync.getByTestId("anki-sync-times")).toHaveText("synced just now · next sync in 15 min", { timeout: 30_000 });
    await page.clock.fastForward("04:00");
    await expect(sync.getByTestId("anki-sync-times")).toHaveText("synced 4 min ago · next sync in 11 min");
    await expect(sync.getByRole("button", { name: "Sync now" })).toHaveCount(0);
    await expect(sync.getByRole("link", { name: "Practice → Words" })).toHaveAttribute("href", "/vocabulary");
    await expect(sync.getByRole("button", { name: "Preview" })).toBeVisible();
    await expect(sync.getByTestId("anki-result")).toContainText("Last synced");
    await expect(page.getByTestId("anki-how-it-works")).toContainText("every 15 minutes while it's open on a computer");
  } finally {
    await context.close();
  }
});
