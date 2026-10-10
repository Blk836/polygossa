import type { AnkiCardInfo } from "./anki-connect";
import { exampleWords } from "./anki-decks";
import type { AnkiDeckChoice, AnkiNoteTypeChoice } from "./anki-types";

export type SkipReason = "cloze" | "no-word" | null;

export interface ModelInDeck {
  modelId: number;
  name: string;
  ids: number[];
  fields: string[];
  sample: AnkiCardInfo[];
}

export interface NoteTypeSetup extends AnkiNoteTypeChoice {
  cards: number;
  fields: string[];
  sample: AnkiCardInfo[];
  isNew: boolean;
  skipReason: SkipReason;
}

export interface ReadPlan {
  reads: { ids: number[]; wordField: string; meaningField?: string }[];
  skipped: number;
  waiting: number;
}

const WORD_NAMES = ["word", "target word", "target", "vocab", "vocabulary", "term", "expression", "front"];
const MEANING_NAMES = ["meaning", "definition", "translation", "english", "back"];

function firstNamed(fields: string[], names: string[], not?: string): string | undefined {
  for (const name of names) {
    const found = fields.find((f) => f.trim().toLowerCase() === name && f !== not);
    if (found) return found;
  }
  return undefined;
}

export function guessWordField(fields: string[]): string {
  return firstNamed(fields, WORD_NAMES) ?? fields[0] ?? "";
}

export function guessMeaningField(fields: string[], wordField: string): string | undefined {
  return firstNamed(fields, MEANING_NAMES, wordField);
}

export function isCloze(name: string, sample: AnkiCardInfo[]): boolean {
  return /cloze/i.test(name) || sample.some((c) => Object.values(c.fields).some((f) => /\{\{c\d+::/.test(f.value)));
}

export function noWrittenWord(sample: AnkiCardInfo[], field: string): boolean {
  return exampleWords(sample, field).length === 0 && sample.some((c) => /<img|\[sound:/i.test(c.fields[field]?.value ?? ""));
}

function guessed(model: ModelInDeck): Pick<NoteTypeSetup, "wordField" | "meaningField" | "skipReason"> {
  const word = guessWordField(model.fields);
  let skipReason: SkipReason = null;
  if (isCloze(model.name, model.sample)) skipReason = "cloze";
  else if (noWrittenWord(model.sample, word)) skipReason = "no-word";
  if (skipReason) return { skipReason };
  return { wordField: word, meaningField: guessMeaningField(model.fields, word), skipReason };
}

function legacyFits(deck: AnkiDeckChoice | undefined, fields: string[]): deck is AnkiDeckChoice {
  return !!deck && !deck.noteTypes?.length && fields.includes(deck.wordField);
}

export function setupFor(model: ModelInDeck, deck: AnkiDeckChoice | undefined): NoteTypeSetup {
  const base = { modelId: model.modelId, name: model.name, cards: model.ids.length, fields: model.fields, sample: model.sample };
  const saved = deck?.noteTypes?.find((t) => t.modelId === model.modelId);
  if (saved) return { ...base, wordField: saved.wordField, meaningField: saved.meaningField, isNew: false, skipReason: null };
  if (legacyFits(deck, model.fields)) {
    const meaningField = deck.meaningField && model.fields.includes(deck.meaningField) ? deck.meaningField : undefined;
    return { ...base, wordField: deck.wordField, meaningField, isNew: false, skipReason: null };
  }
  return { ...base, ...guessed(model), isNew: !!deck };
}

export function planDeck(deck: AnkiDeckChoice, models: Pick<ModelInDeck, "modelId" | "fields" | "ids">[]): ReadPlan {
  const plan: ReadPlan = { reads: [], skipped: 0, waiting: 0 };
  for (const model of models) {
    const saved = deck.noteTypes?.find((t) => t.modelId === model.modelId);
    if (saved?.wordField) plan.reads.push({ ids: model.ids, wordField: saved.wordField, meaningField: saved.meaningField });
    else if (saved) plan.skipped += model.ids.length;
    else if (legacyFits(deck, model.fields)) plan.reads.push({ ids: model.ids, wordField: deck.wordField, meaningField: deck.meaningField });
    else plan.waiting += model.ids.length;
  }
  return plan;
}
