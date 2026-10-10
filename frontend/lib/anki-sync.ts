import { api, ApiError } from "./api";
import { AnkiUnreachable, cardIds, cardsInfo } from "./anki-connect";
import { chunks, toPayload } from "./anki-decks";
import type { AnkiDeckChoice, AnkiRun } from "./anki-types";

export const CARDS_PER_BATCH = 500;

export type SyncResult =
  | { kind: "done"; run: AnkiRun }
  | { kind: "stopped"; run: AnkiRun }
  | { kind: "busy" }
  | { kind: "unreachable" }
  | { kind: "nothing" };

export interface SyncOptions {
  dryRun: boolean;
  onlySyncedBefore: boolean;
  onProgress?: (done: number, total: number) => void;
}

type Planned = { deck: AnkiDeckChoice; ids: number[] };

async function plan(decks: AnkiDeckChoice[]): Promise<Planned[] | null> {
  try {
    const planned: Planned[] = [];
    for (const deck of decks) planned.push({ deck, ids: await cardIds(deck.ankiDeckId) });
    return planned;
  } catch (e) {
    if (e instanceof AnkiUnreachable) return null;
    throw e;
  }
}

async function start(dryRun: boolean): Promise<AnkiRun | null> {
  try {
    return await api<AnkiRun>("anki/runs", { body: { dryRun } });
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) return null;
    throw e;
  }
}

async function send(run: AnkiRun, planned: Planned[], onProgress: SyncOptions["onProgress"]): Promise<AnkiRun | null> {
  const total = planned.reduce((n, p) => n + p.ids.length, 0);
  let done = 0;
  let latest = run;
  onProgress?.(0, total);
  for (const { deck, ids } of planned) {
    for (const batch of chunks(ids, CARDS_PER_BATCH)) {
      let infos;
      try {
        infos = await cardsInfo(batch);
      } catch {
        return null;
      }
      const cards = infos.map((c) => toPayload(c, deck));
      latest = await api<AnkiRun>(`anki/runs/${run.id}/cards`, { body: { ankiDeckId: deck.ankiDeckId, cards } });
      done += batch.length;
      onProgress?.(done, total);
    }
  }
  return latest;
}

export async function syncWithAnki(options: SyncOptions): Promise<SyncResult> {
  const { decks } = await api<{ decks: AnkiDeckChoice[] }>("anki/decks");
  const chosen = options.onlySyncedBefore ? decks.filter((d) => d.firstSyncedAt) : decks;
  if (!chosen.length) return { kind: "nothing" };
  const planned = await plan(chosen);
  if (!planned) return { kind: "unreachable" };
  const run = await start(options.dryRun);
  if (!run) return { kind: "busy" };
  const sent = await send(run, planned, options.onProgress);
  if (!sent) return { kind: "stopped", run: await api<AnkiRun>(`anki/runs/${run.id}/stop`, { method: "POST" }) };
  const finished = await api<AnkiRun>(`anki/runs/${run.id}/finish`, { body: { ankiDeckIds: chosen.map((d) => d.ankiDeckId) } });
  return { kind: "done", run: finished };
}
