import { expect, type Page, type Route } from "@playwright/test";

export interface FakeCard {
  fields: Record<string, string>;
  type: number;
  interval: number;
}

export interface FakeDeck {
  id: number;
  name: string;
  cards: FakeCard[];
}

export const mature = (fields: Record<string, string>): FakeCard => ({ fields, type: 2, interval: 30 });
export const young = (fields: Record<string, string>): FakeCard => ({ fields, type: 2, interval: 3 });

export class FakeAnki {
  decks: FakeDeck[] = [];
  permission: "granted" | "denied" = "granted";
  apiKey: string | null = null;
  outdated = false;
  closed = false;
  closeAfterCardsInfo: number | null = null;
  cardsInfoDelayMs = 0;
  calls: { action: string; params: Record<string, unknown>; key?: string }[] = [];
  private cardsInfoCalls = 0;

  async install(page: Page) {
    await page.route(/^http:\/\/127\.0\.0\.1:8765\/?$/, (route) => this.answer(route));
  }

  private allCards() {
    return this.decks.flatMap((d) => d.cards.map((c, i) => ({ ...c, deck: d, cardId: d.id * 10_000 + i })));
  }

  private result(action: string, params: Record<string, unknown>): unknown {
    switch (action) {
      case "deckNamesAndIds":
        return Object.fromEntries(this.decks.map((d) => [d.name, d.id]));
      case "findCards": {
        const id = Number(String(params.query).replace("did:", ""));
        return this.allCards().filter((c) => c.deck.id === id).map((c) => c.cardId);
      }
      case "cardsInfo": {
        const wanted = new Set(params.cards as number[]);
        return this.allCards().filter((c) => wanted.has(c.cardId)).map((c) => ({
          cardId: c.cardId, deckName: c.deck.name, modelName: "Basic", type: c.type, interval: c.interval,
          fields: Object.fromEntries(Object.entries(c.fields).map(([name, value], order) => [name, { value, order }])),
        }));
      }
      default:
        return 6;
    }
  }

  private async answer(route: Route) {
    if (this.closed) return route.abort("connectionrefused");
    const body = JSON.parse(route.request().postData() ?? "{}") as { action: string; params?: Record<string, unknown>; key?: string };
    const params = body.params ?? {};
    this.calls.push({ action: body.action, params, key: body.key });
    const headers = { "Access-Control-Allow-Origin": "*" };
    if (body.action === "requestPermission") {
      if (this.outdated) return route.fulfill({ headers, json: { result: null, error: "unsupported action" } });
      return route.fulfill({ headers, json: { result: { permission: this.permission, requireApikey: this.apiKey !== null, version: 6 }, error: null } });
    }
    if (this.apiKey !== null && body.key !== this.apiKey) return route.fulfill({ headers, json: { result: null, error: "valid api key must be provided" } });
    if (body.action === "cardsInfo" && (await this.closesNow())) return route.abort("connectionrefused");
    return route.fulfill({ headers, json: { result: this.result(body.action, params), error: null } });
  }

  private async closesNow(): Promise<boolean> {
    if (this.closeAfterCardsInfo !== null && this.cardsInfoCalls++ >= this.closeAfterCardsInfo) {
      this.closed = true;
      return true;
    }
    if (this.cardsInfoDelayMs) await new Promise((done) => setTimeout(done, this.cardsInfoDelayMs));
    return false;
  }
}

export function stamp(): string {
  return `k${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export async function chooseDecks(page: Page, decks: { ankiDeckId: number; name: string; language: string; wordField: string; meaningField?: string }[]) {
  const res = await page.request.put("/api/anki/decks", { data: { decks } });
  expect(res.ok(), await res.text()).toBe(true);
}

export async function cleanUpAnki(page: Page, language: string, terms: string[]) {
  await page.request.delete("/api/anki/decks");
  for (const term of terms) await page.request.delete(`/api/vocabulary/by-term?language=${language}&term=${encodeURIComponent(term)}`);
}

export async function cleanUpPrefix(page: Page, language: string, prefix: string) {
  await page.request.delete("/api/anki/decks");
  await deleteWords(page, language, prefix);
}

export async function deleteWords(page: Page, language: string, prefix: string) {
  for (;;) {
    const found = await (await page.request.get(`/api/vocabulary?language=${language}&q=${prefix}&size=200`)).json();
    const ids = ((found.items ?? []) as { id: number; term: string }[]).filter((e) => e.term.startsWith(prefix)).map((e) => e.id);
    if (!ids.length) return;
    expect((await page.request.post("/api/vocabulary/delete", { data: { ids } })).ok()).toBe(true);
  }
}

export async function syncByApi(page: Page, deckId: number, cards: { word: string; type: number; interval: number }[]) {
  const run = (await (await page.request.post("/api/anki/runs", { data: { dryRun: false } })).json()) as { id: number };
  expect((await page.request.post(`/api/anki/runs/${run.id}/cards`, { data: { ankiDeckId: deckId, cards } })).ok()).toBe(true);
  expect((await page.request.post(`/api/anki/runs/${run.id}/finish`, { data: { ankiDeckIds: [deckId] } })).ok()).toBe(true);
  return run.id;
}

export async function myLanguage(page: Page): Promise<string> {
  await page.goto("/library");
  return ((await (await page.request.get("/api/me")).json()).targetLanguage ?? "es") as string;
}

export async function statusOf(page: Page, language: string, term: string): Promise<string | null> {
  const found = await (await page.request.get(`/api/vocabulary?language=${language}&q=${encodeURIComponent(term)}&size=50`)).json();
  return ((found.items ?? []) as { term: string; status: string }[]).find((e) => e.term === term)?.status ?? null;
}
