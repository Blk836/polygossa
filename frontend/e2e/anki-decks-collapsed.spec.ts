import { expect, test, type Page } from "@playwright/test";
import { FakeAnki, mature, modelOf } from "./anki-helpers";

const connectGroup = (page: Page) => page.getByRole("group", { name: "Connect to Anki" });
const syncGroup = (page: Page) => page.getByRole("group", { name: "Sync with Anki" });
const decksSection = (page: Page) => connectGroup(page).getByTestId("anki-decks");
const decksTitle = (page: Page) => decksSection(page).locator("summary");
const deckRow = (page: Page, name: string) =>
  connectGroup(page).getByTestId("anki-deck").filter({ has: page.getByRole("checkbox", { name, exact: true, includeHidden: true }) });

const SPANISH = { ankiDeckId: 71, name: "Spanish", language: "es", wordField: "Front", noteTypes: [{ modelId: modelOf(mature({ Front: "", Back: "" })).id, name: "Front+Back", wordField: "Front" }] };
const FRENCH = { ankiDeckId: 72, name: "French", language: "fr", wordField: "Front", noteTypes: [{ modelId: modelOf(mature({ Front: "", Back: "" })).id, name: "Front+Back", wordField: "Front" }] };

function fakeAnki() {
  const anki = new FakeAnki();
  anki.decks = [
    { id: 71, name: "Spanish", cards: [mature({ Front: "perro", Back: "dog" })] },
    { id: 72, name: "French", cards: [mature({ Front: "chien", Back: "dog" })] },
  ];
  return anki;
}

async function openAnkiTab(page: Page, anki: FakeAnki, initial: unknown[]) {
  let decks = initial;
  const puts: { decks: { language: string }[] }[] = [];
  await anki.install(page);
  await page.route("**/api/anki/decks", async (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      const body = route.request().postDataJSON();
      puts.push(body);
      decks = body.decks;
      return route.fulfill({ json: { decks } });
    }
    if (method === "DELETE") {
      decks = [];
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({ json: { decks } });
  });
  await page.goto("/settings/anki");
  return puts;
}

test("already connected: deck settings start folded, titled with their count and languages", async ({ page }) => {
  await openAnkiTab(page, fakeAnki(), [SPANISH, FRENCH]);
  await expect(connectGroup(page).getByRole("status")).toHaveText("Connected to Anki");
  await expect(decksTitle(page)).toHaveText("Your decks · 2 decks · Spanish, French");
  await expect(decksSection(page)).not.toHaveAttribute("open");
  await expect(deckRow(page, "Spanish")).toBeHidden();
  await expect(connectGroup(page).getByRole("button", { name: "Save decks" })).toBeHidden();
  await expect(syncGroup(page).getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(syncGroup(page).getByRole("button", { name: "Disconnect Anki" })).toBeVisible();
});

test("opening the folded section shows every deck's settings and Save decks", async ({ page }) => {
  await openAnkiTab(page, fakeAnki(), [SPANISH, FRENCH]);
  await decksTitle(page).click();
  await expect(deckRow(page, "Spanish").getByRole("combobox", { name: "Language" })).toBeVisible();
  await expect(deckRow(page, "French").getByRole("combobox", { name: "Language" })).toBeVisible();
  await expect(connectGroup(page).getByTestId("anki-note-type").first()).toBeVisible();
  await expect(connectGroup(page).getByRole("button", { name: "Save decks" })).toBeVisible();
});

test("saving from the opened section keeps it open and updates its title", async ({ page }) => {
  const puts = await openAnkiTab(page, fakeAnki(), [SPANISH]);
  await expect(decksTitle(page)).toHaveText("Your decks · 1 deck · Spanish");
  await decksTitle(page).click();
  await deckRow(page, "Spanish").getByRole("combobox", { name: "Language" }).selectOption("it");
  await connectGroup(page).getByRole("button", { name: "Save decks" }).click();
  await expect(connectGroup(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(decksSection(page)).toHaveAttribute("open");
  await expect(decksTitle(page)).toHaveText("Your decks · 1 deck · Italian");
  expect(puts.at(-1)!.decks.map((d) => d.language)).toEqual(["it"]);
  await expect(syncGroup(page)).toBeVisible();
});

test("first-time setup shows the decks open, and they stay open after saving", async ({ page }) => {
  await openAnkiTab(page, fakeAnki(), []);
  await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
  await expect(decksSection(page)).toHaveAttribute("open");
  await deckRow(page, "Spanish").getByRole("checkbox").check();
  await expect(connectGroup(page).getByRole("button", { name: "Save decks" })).toBeEnabled();
  await connectGroup(page).getByRole("button", { name: "Save decks" }).click();
  await expect(connectGroup(page).getByRole("status").filter({ hasText: "Saved" })).toBeVisible();
  await expect(decksSection(page)).toHaveAttribute("open");
  await expect(deckRow(page, "Spanish").getByRole("combobox", { name: "Language" })).toBeVisible();
});

test("disconnecting, then connecting again, shows the decks open as for a first-time setup", async ({ page }) => {
  await openAnkiTab(page, fakeAnki(), [SPANISH]);
  await expect(decksSection(page)).not.toHaveAttribute("open");
  await syncGroup(page).getByRole("button", { name: "Disconnect Anki" }).click();
  await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
  await expect(decksSection(page)).toHaveAttribute("open");
  await expect(deckRow(page, "Spanish")).toBeVisible();
});

test("after the first sync, How it works and Your decks both start closed", async ({ page }) => {
  await openAnkiTab(page, fakeAnki(), [{ ...SPANISH, firstSyncedAt: "2026-10-01T10:00:00Z" }]);
  await expect(connectGroup(page).getByRole("status")).toHaveText("Connected to Anki");
  await expect(page.getByTestId("anki-how-it-works")).not.toHaveAttribute("open");
  await expect(decksSection(page)).not.toHaveAttribute("open");
});

test("a note type waiting for its word field opens the section so it is seen", async ({ page }) => {
  const anki = fakeAnki();
  anki.decks[0].cards.push({ ...mature({ Vocab: "gato" }), model: "Later" });
  await openAnkiTab(page, anki, [SPANISH]);
  await expect(decksSection(page)).toHaveAttribute("open");
  await expect(connectGroup(page).getByTestId("anki-note-type").filter({ hasText: "Later" })).toContainText("New: check its word field");
});
