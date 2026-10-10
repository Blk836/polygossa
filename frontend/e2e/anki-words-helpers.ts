import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { FakeAnki, type FakeCard } from "./anki-helpers";

export type Learner = { context: BrowserContext; page: Page; anki: FakeAnki };

export async function newLearner(browser: Browser, device: Parameters<Browser["newContext"]>[0] = {}): Promise<Learner> {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...device, baseURL: test.info().project.use.baseURL });
  const email = `anki-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
  const res = await context.request.post("/api/auth/signup", { data: { email, password: "password123", displayName: "Anki learner" } });
  expect(res.ok(), await res.text()).toBe(true);
  expect((await context.request.patch("/api/me", { data: { tours: false } })).ok()).toBe(true);
  const page = await context.newPage();
  const anki = new FakeAnki();
  await anki.install(page);
  return { context, page, anki };
}

export async function connectDecks(page: Page, decks: { id: number; synced: boolean }[]) {
  const res = await page.request.put("/api/anki/decks", {
    data: { decks: decks.map((d) => ({ ankiDeckId: d.id, name: `Deck ${d.id}`, language: "es", wordField: "Word" })) },
  });
  expect(res.ok(), await res.text()).toBe(true);
  for (const deck of decks.filter((d) => d.synced)) await syncDeck(page, deck.id, []);
}

export async function syncDeck(page: Page, deckId: number, cards: { word: string; type: number; interval: number }[]) {
  const run = (await (await page.request.post("/api/anki/runs", { data: { dryRun: false } })).json()) as { id: number };
  expect((await page.request.post(`/api/anki/runs/${run.id}/cards`, { data: { ankiDeckId: deckId, cards } })).ok()).toBe(true);
  expect((await page.request.post(`/api/anki/runs/${run.id}/finish`, { data: { ankiDeckIds: [deckId] } })).ok()).toBe(true);
}

export async function saveWord(page: Page, term: string, status = "learning") {
  expect((await page.request.post("/api/vocabulary", { data: { language: "es", term, status } })).ok()).toBe(true);
}

export function deck(id: number, cards: FakeCard[]) {
  return { id, name: `Deck ${id}`, cards };
}

export const bar = (page: Page) => page.getByTestId("anki-bar");
export const syncNow = (page: Page) => bar(page).getByRole("button", { name: "Sync now" });
export const wordRow = (page: Page, term: string) => page.getByRole("main").getByRole("listitem").filter({ hasText: term });
