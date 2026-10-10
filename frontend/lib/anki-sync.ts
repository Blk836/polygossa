import { api, ApiError } from "./api";
import { AnkiUnreachable, cardsInfo, modelFieldNames, noteTypesInDeck } from "./anki-connect";
import { chunks, toPayload } from "./anki-decks";
import { planDeck, type ReadPlan } from "./anki-note-types";
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

type Planned = ReadPlan & { deck: AnkiDeckChoice };

async function planFor(deck: AnkiDeckChoice): Promise<Planned> {
  const models = await noteTypesInDeck(deck.ankiDeckId);
  const legacy = !deck.noteTypes?.length;
  const withFields = await Promise.all(models.map(async (m) => ({ ...m, fields: legacy ? await modelFieldNames(m.name) : [] })));
  return { deck, ...planDeck(deck, withFields) };
}

async function plan(decks: AnkiDeckChoice[]): Promise<Planned[] | null> {
  try {
    const planned: Planned[] = [];
    for (const deck of decks) planned.push(await planFor(deck));
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

type Batch = { deckId: number; ids: number[]; fields: { wordField: string; meaningField?: string } };

function batchesOf(planned: Planned[]): Batch[] {
  return planned.flatMap(({ deck, reads }) => reads.flatMap((read) =>
    chunks(read.ids, CARDS_PER_BATCH).map((ids) => ({ deckId: deck.ankiDeckId, ids, fields: read }))));
}

async function send(run: AnkiRun, planned: Planned[], onProgress: SyncOptions["onProgress"]): Promise<boolean> {
  const batches = batchesOf(planned);
  const total = batches.reduce((n, b) => n + b.ids.length, 0);
  let done = 0;
  onProgress?.(0, total);
  for (const batch of batches) {
    let infos;
    try {
      infos = await cardsInfo(batch.ids);
    } catch {
      return false;
    }
    const cards = infos.map((c) => toPayload(c, batch.fields));
    await api<AnkiRun>(`anki/runs/${run.id}/cards`, { body: { ankiDeckId: batch.deckId, cards } });
    done += batch.ids.length;
    onProgress?.(done, total);
  }
  return true;
}

export async function syncWithAnki(options: SyncOptions): Promise<SyncResult> {
  const { decks } = await api<{ decks: AnkiDeckChoice[] }>("anki/decks");
  const chosen = options.onlySyncedBefore ? decks.filter((d) => d.firstSyncedAt) : decks;
  if (!chosen.length) return { kind: "nothing" };
  const planned = await plan(chosen);
  if (!planned) return { kind: "unreachable" };
  const run = await start(options.dryRun);
  if (!run) return { kind: "busy" };
  if (!(await send(run, planned, options.onProgress))) {
    return { kind: "stopped", run: await api<AnkiRun>(`anki/runs/${run.id}/stop`, { method: "POST" }) };
  }
  const skippedNoteType = planned.reduce((n, p) => n + p.skipped, 0);
  const waitingNoteType = planned.reduce((n, p) => n + p.waiting, 0);
  const finished = await api<AnkiRun>(`anki/runs/${run.id}/finish`, {
    body: { ankiDeckIds: chosen.map((d) => d.ankiDeckId), skippedNoteType, waitingNoteType },
  });
  return { kind: "done", run: finished };
}
