import { expect, test, type Page } from "@playwright/test";
import { FakeAnki, mature } from "./anki-helpers";

const connectGroup = (page: Page) => page.getByRole("group", { name: "Connect to Anki" });
const syncGroup = (page: Page) => page.getByRole("group", { name: "Sync with Anki" });
const away = "Your account is connected to Anki, but this browser can't reach it right now.";
const SAVED = [{ ankiDeckId: 71, name: "Spanish", language: "es", wordField: "Front", firstSyncedAt: "2026-10-01T10:00:00Z" }];

function ankiWithDeck() {
  const anki = new FakeAnki();
  anki.decks = [{ id: 71, name: "Spanish", cards: [mature({ Front: "perro", Back: "dog" })] }];
  return anki;
}

async function openAnkiTab(page: Page, anki: FakeAnki, decks: unknown[] = SAVED) {
  await anki.install(page);
  await page.route("**/api/anki/decks", (route) => (route.request().method() === "GET" ? route.fulfill({ json: { decks } }) : route.fallback()));
  await page.goto("/settings/anki");
}

const permissionAsks = (anki: FakeAnki) => anki.calls.filter((c) => c.action === "requestPermission").length;

async function expectConnected(page: Page) {
  await expect(connectGroup(page).getByRole("status")).toHaveText("Connected to Anki");
  await expect(connectGroup(page).getByTestId("anki-deck")).toHaveCount(1);
  await expect(connectGroup(page).getByTestId("anki-deck").getByRole("checkbox")).toBeChecked();
  await expect(connectGroup(page).getByRole("button", { name: /Connect to Anki/ })).toHaveCount(0);
}

async function expectAway(page: Page) {
  await expect(connectGroup(page)).toContainText(away);
  await expect(connectGroup(page).getByRole("button", { name: "Reconnect to Anki" })).toBeVisible();
  await expect(connectGroup(page).getByRole("button", { name: "Connect to Anki", exact: true })).toHaveCount(0);
  await expect(connectGroup(page).getByTestId("anki-deck")).toHaveCount(0);
}

test("connected, with Anki open: the tab opens connected without asking Anki for permission", async ({ page }) => {
  const anki = ankiWithDeck();
  await openAnkiTab(page, anki);
  await expectConnected(page);
  expect(permissionAsks(anki)).toBe(0);
});

test("coming back to the Anki tab shows it connected again", async ({ page }) => {
  const anki = ankiWithDeck();
  await openAnkiTab(page, anki);
  await expectConnected(page);
  const tabs = page.getByRole("navigation", { name: "Settings pages" });
  await tabs.getByRole("link", { name: "Profile" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await tabs.getByRole("link", { name: "Anki" }).click();
  await expectConnected(page);
  expect(permissionAsks(anki)).toBe(0);
});

test("while the quiet check runs, it says so instead of offering to connect", async ({ page }) => {
  const anki = ankiWithDeck();
  await anki.install(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(/^http:\/\/127\.0\.0\.1:8765\/?$/, async (route) => {
    await held;
    await route.fallback();
  });
  await page.route("**/api/anki/decks", (route) => (route.request().method() === "GET" ? route.fulfill({ json: { decks: SAVED } }) : route.fallback()));
  await page.goto("/settings/anki");
  await expect(connectGroup(page).getByRole("status")).toHaveText("Checking Anki…");
  await expect(connectGroup(page).getByRole("button", { name: /Connect/ })).toHaveCount(0);
  release();
  await expectConnected(page);
});

test("connected, but Anki is closed: it says so, offers to reconnect, and keeps sync and disconnect", async ({ page }) => {
  const anki = ankiWithDeck();
  anki.closed = true;
  await openAnkiTab(page, anki);
  await expectAway(page);
  await expect(syncGroup(page)).toBeVisible();
  await expect(syncGroup(page).getByRole("button", { name: "Disconnect Anki" })).toBeVisible();

  anki.closed = false;
  await connectGroup(page).getByRole("button", { name: "Reconnect to Anki" }).click();
  await expectConnected(page);
});

test("connected from another browser: no permission prompt on opening, Reconnect asks for it", async ({ page }) => {
  const anki = ankiWithDeck();
  anki.untrusted = true;
  await openAnkiTab(page, anki);
  await expectAway(page);
  expect(permissionAsks(anki)).toBe(0);

  await connectGroup(page).getByRole("button", { name: "Reconnect to Anki" }).click();
  await expectConnected(page);
  expect(permissionAsks(anki)).toBe(1);
});

test("an API key kept in this browser connects straight away", async ({ page }) => {
  const anki = ankiWithDeck();
  anki.apiKey = "s3cret";
  await page.addInitScript(() => localStorage.setItem("anki-connect-key", "s3cret"));
  await openAnkiTab(page, anki);
  await expectConnected(page);
  expect(permissionAsks(anki)).toBe(0);
});

test("an API key this browser doesn't have: reconnecting asks for it", async ({ page }) => {
  const anki = ankiWithDeck();
  anki.apiKey = "s3cret";
  await openAnkiTab(page, anki);
  await expectAway(page);
  await connectGroup(page).getByRole("button", { name: "Reconnect to Anki" }).click();
  await expect(connectGroup(page).getByLabel("AnkiConnect API key")).toBeVisible();
});

test("never connected: Connect to Anki as before, and Anki isn't contacted until it's clicked", async ({ page }) => {
  const anki = ankiWithDeck();
  await openAnkiTab(page, anki, []);
  await expect(connectGroup(page).getByRole("button", { name: "Connect to Anki", exact: true })).toBeVisible();
  await expect(connectGroup(page)).not.toContainText(away);
  await page.waitForTimeout(500);
  expect(anki.calls.filter((c) => c.action === "requestPermission" || c.action === "version")).toEqual([]);
});
