import type { AnkiRun, AnkiWordLink } from "./anki-types";
import type { WordStatus } from "./types";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const words = (n: number) => `${n} ${n === 1 ? "word" : "words"}`;

export function syncedAgoText(ms: number): string {
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)} h ago`;
  const days = Math.floor(ms / DAY);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

export function nextSyncText(ms: number): string {
  return `next sync in ${Math.max(1, Math.ceil(ms / MINUTE))} min`;
}

export function changeSummary(run: AnkiRun): string | null {
  const added = run.addedKnown + run.addedLearning;
  if (run.becameKnown && added) return `${words(run.becameKnown)} now known, ${added} added`;
  if (run.becameKnown) return `${words(run.becameKnown)} now known`;
  if (added) return `${words(added)} added`;
  return null;
}

const CARD_STATES: Record<AnkiWordLink["state"], string> = {
  mature: "In Anki: mature card (next review 21+ days)",
  young: "In Anki: being learned",
  new: "In Anki: not reviewed yet",
};

export function ankiBadgeText(link: AnkiWordLink, status: WordStatus): string {
  const state = CARD_STATES[link.state];
  return link.promoted && status === "known" ? `${state}. Known through Anki` : state;
}
