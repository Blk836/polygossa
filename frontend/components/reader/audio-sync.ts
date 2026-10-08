// Pure audio-sync logic: which word is playing, and where each sentence starts and ends.
import type { Token, WordTiming } from "@/lib/types";

/** How long a word stays highlighted after its timing ends (covers gaps between words). */
export const LINGER_MS = 400;

/** The word being spoken at time t, given timings sorted by start. */
export function findActive(timings: WordTiming[], t: number): WordTiming | null {
  let lo = 0;
  let hi = timings.length - 1;
  let found: WordTiming | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timings[mid].s <= t) {
      found = timings[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found && t <= found.e + LINGER_MS ? found : null;
}

export function formatTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Sentence number → index of its first word token. */
export function firstWordOfSentence(tokens: Token[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of tokens) if (t.word && !m.has(t.sentence)) m.set(t.sentence, t.index);
  return m;
}

export interface Segment {
  sentence: number;
  start: number;
  end: number;
}

/** Sentence segments (for stepping and looping): each sentence runs from its first timed word to the next sentence's start. */
export function sentenceSegments(tokens: Token[], timings: WordTiming[], durationMs: number): Segment[] {
  const sorted = [...timings].sort((a, b) => a.s - b.s);
  const tokenSentence = new Map(tokens.map((t) => [t.index, t.sentence]));
  const starts = new Map<number, number>();
  for (const t of sorted) {
    const s = tokenSentence.get(t.i);
    if (s !== undefined && !starts.has(s)) starts.set(s, t.s);
  }
  const ordered = [...starts.entries()]; // already ascending: `starts` is filled in start-time order
  const lastEnd = sorted.at(-1)?.e ?? 0;
  return ordered.map(([sentence, start], k) => ({
    sentence,
    start,
    end: k + 1 < ordered.length ? ordered[k + 1][1] : Math.max(durationMs, lastEnd),
  }));
}
