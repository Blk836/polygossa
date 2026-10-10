import { expect, test, type Page } from "@playwright/test";
import { FakeAnki, mature } from "./anki-helpers";

const connectGroup = (page: Page) => page.getByRole("group", { name: "Connect to Anki" });

async function openAnkiTab(page: Page, anki: FakeAnki) {
  await anki.install(page);
  await page.route("**/api/anki/decks", (route) => (route.request().method() === "GET" ? route.fulfill({ json: { decks: [] } }) : route.fallback()));
  await page.goto("/settings/anki");
}

test("the Anki tab explains the set-up and how sync works", async ({ page }) => {
  await openAnkiTab(page, new FakeAnki());
  await expect(connectGroup(page)).toContainText("2055492159");
  await expect(connectGroup(page)).toContainText("Restart Anki, and keep it open");
  await expect(connectGroup(page)).toContainText("needs Anki desktop on a computer");
  await expect(connectGroup(page).getByRole("button", { name: "Connect to Anki" })).toBeVisible();
  const rules = page.getByTestId("anki-how-it-works");
  await expect(rules).toContainText("next review 21+ days away");
  await expect(rules).toContainText("Anki only ever moves a word up");
  await expect(rules).toContainText("Anki leaves it alone until that card changes again");
  await expect(rules).toContainText("leave the Review tab here");
});

test("connecting shows my decks: an exported one is recognised, my own is set up by hand with examples", async ({ page }) => {
  const anki = new FakeAnki();
  anki.decks = [
    { id: 71, name: "From the app", cards: [mature({ Word: "perro", Definition: "dog", Language: "French" })] },
    { id: 72, name: "My own", cards: [mature({ Front: "<b>gato</b>", Back: "cat" }), mature({ Front: "casa", Back: "house" })] },
    { id: 73, name: "Empty", cards: [] },
  ];
  await openAnkiTab(page, anki);
  await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
  await expect(connectGroup(page).getByRole("status")).toHaveText("Connected to Anki");
  const decks = connectGroup(page).getByTestId("anki-deck");
  await expect(decks).toHaveCount(3);
  await expect(decks.nth(1)).toContainText("exported from this app");
  await expect(decks.nth(0).getByRole("checkbox")).toBeDisabled();
  await decks.nth(1).getByRole("checkbox").check();
  await expect(decks.nth(1).getByLabel("Word field", { exact: true })).toHaveValue("Word");
  await expect(decks.nth(1).getByLabel("Meaning field", { exact: true })).toHaveValue("Definition");
  await expect(decks.nth(1).getByLabel("Language", { exact: true })).toHaveValue("fr");
  await decks.nth(2).getByRole("checkbox").check();
  await expect(decks.nth(2).getByLabel("Word field", { exact: true })).toHaveValue("Front");
  await expect(decks.nth(2).getByLabel("Meaning field", { exact: true })).toHaveValue("");
  await expect(decks.nth(2).getByTestId("anki-examples")).toHaveText("Examples: gato, casa");
  await decks.nth(2).getByLabel("Word field", { exact: true }).selectOption("Back");
  await expect(decks.nth(2).getByTestId("anki-examples")).toHaveText("Examples: cat, house");
});

test("when Anki refuses, the config line for this site is shown and nothing is saved", async ({ page }) => {
  const anki = new FakeAnki();
  anki.permission = "denied";
  const saves: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/anki/decks") && r.method() !== "GET") saves.push(r.method()); });
  await openAnkiTab(page, anki);
  await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
  const alert = connectGroup(page).getByRole("alert");
  await expect(alert).toContainText("Anki refused the connection");
  await expect(alert).toContainText(`"webCorsOriginList": ["${new URL(test.info().project.use.baseURL!).origin}"]`);
  await expect(connectGroup(page).getByTestId("anki-deck")).toHaveCount(0);
  expect(saves).toEqual([]);
});

test("when AnkiConnect asks for its API key, it is kept in this browser only", async ({ page }) => {
  const anki = new FakeAnki();
  anki.apiKey = "s3cret";
  anki.decks = [{ id: 74, name: "Keyed", cards: [mature({ Front: "perro" })] }];
  const sentToUs: string[] = [];
  page.on("request", (r) => { if (r.url().includes("/api/")) sentToUs.push(`${r.url()} ${r.postData() ?? ""}`); });
  await openAnkiTab(page, anki);
  await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
  await connectGroup(page).getByLabel("AnkiConnect API key").fill("wrong");
  await connectGroup(page).getByRole("button", { name: "Use this key" }).click();
  await expect(connectGroup(page).getByRole("alert")).toHaveText("That key isn't right.");
  await connectGroup(page).getByLabel("AnkiConnect API key").fill("s3cret");
  await connectGroup(page).getByRole("button", { name: "Use this key" }).click();
  await expect(connectGroup(page).getByTestId("anki-deck")).toHaveCount(1);
  expect(await page.evaluate(() => localStorage.getItem("anki-connect-key"))).toBe("s3cret");
  expect(sentToUs.filter((r) => r.includes("s3cret"))).toEqual([]);
  await page.evaluate(() => localStorage.removeItem("anki-connect-key"));
});

test("when Anki can't be reached, the tab says so and what to check", async ({ page }) => {
  const anki = new FakeAnki();
  anki.closed = true;
  await openAnkiTab(page, anki);
  await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
  const alert = connectGroup(page).getByRole("alert");
  await expect(alert).toContainText("Can't reach Anki");
  await expect(alert).toContainText("Is Anki desktop open");
  await expect(alert).toContainText("2055492159");
  await expect(alert).toContainText("site settings");
});

test("an AnkiConnect too old to ask for permission is to be updated", async ({ page }) => {
  const anki = new FakeAnki();
  anki.outdated = true;
  await openAnkiTab(page, anki);
  await connectGroup(page).getByRole("button", { name: "Connect to Anki" }).click();
  await expect(connectGroup(page).getByRole("alert")).toContainText("Check for updates");
});
