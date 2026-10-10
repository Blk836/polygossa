import type { AnkiOutcome, AnkiRun } from "./anki-types";

export interface OutcomeLine {
  outcome: AnkiOutcome;
  count: number;
  label: string;
}

type Phrase = (n: number, preview: boolean) => string;

const words = (n: number) => (n === 1 ? "word" : "words");
const cards = (n: number) => (n === 1 ? "card" : "cards");
const will = (preview: boolean, future: string, past: string) => (preview ? future : past);

const PHRASES: [AnkiOutcome, keyof AnkiRun, Phrase][] = [
  ["became_known", "becameKnown", (n, p) => `${n} of your words ${will(p, "will become", "became")} known`],
  ["added_known", "addedKnown", (n, p) => `${n} ${words(n)} ${will(p, "will be", n === 1 ? "was" : "were")} added as known`],
  ["added_learning", "addedLearning", (n, p) => `${n} ${words(n)} ${will(p, "will be", n === 1 ? "was" : "were")} added as learning`],
  ["over_limit", "overLimit", (n, p) => `${n} ${words(n)} ${will(p, "won't be", n === 1 ? "wasn't" : "weren't")} added because of the Free plan's saved-word limit`],
  ["skipped_empty", "skippedEmpty", (n, p) => `${n} ${cards(n)} ${will(p, "will be", n === 1 ? "was" : "were")} skipped: the word field is empty`],
  ["skipped_too_long", "skippedTooLong", (n, p) => `${n} ${cards(n)} ${will(p, "will be", n === 1 ? "was" : "were")} skipped: longer than 12 words`],
  ["skipped_media", "skippedMedia", (n, p) => `${n} ${cards(n)} ${will(p, "will be", n === 1 ? "was" : "were")} skipped: only an image or a sound`],
  ["leave_review", "leaveReview", (n, p) => `${n} ${words(n)} ${will(p, "will leave", "left")} the Review tab here, since you review ${n === 1 ? "it" : "them"} in Anki`],
];

export function outcomeLines(run: AnkiRun, preview: boolean): OutcomeLine[] {
  return PHRASES.map(([outcome, field, phrase]) => ({ outcome, count: run[field] as number, label: phrase(run[field] as number, preview) }))
    .filter((line) => line.count > 0);
}
