// Pure playback navigation shared by the audio and video players: sentence steps, sentence loop, shortcuts and cueing.
import type { WordTiming } from "@/lib/types";
import type { Segment } from "./audio-sync";

/** Playback speeds offered for audio and video. */
export const SPEEDS = [0.5, 0.75, 0.9, 1, 1.25, 1.5] as const;

/** Index of the sentence playing at `ms` (the first before it starts, the last after the end); -1 with none. */
export function segmentAt(segments: Segment[], ms: number): number {
  let found = segments.length > 0 ? 0 : -1;
  for (let k = 1; k < segments.length && segments[k].start <= ms; k++) found = k;
  return found;
}

/**
 * Where to seek for the current sentence (step 0), the previous (-1) or the next (1); null if there is no such
 * sentence. Going back from the first sentence stays on it.
 */
export function sentenceStart(segments: Segment[], ms: number, step: -1 | 0 | 1): number | null {
  const target = Math.max(0, segmentAt(segments, ms) + step); // with no sentences, 0 is out of range below
  return target < segments.length ? segments[target].start : null;
}

/** With a sentence on loop: where to jump back to once playback leaves it, else null. */
export function loopRestart(looped: Segment | null, ms: number): number | null {
  if (!looped) return null;
  return ms >= looped.end || ms < looped.start ? looped.start : null;
}

/**
 * Where to cue paused media for a page starting at token `fromToken`: when its first timed word (by position) is
 * spoken. 0 for page 1 (null) or when nothing from there on is timed.
 */
export function cueMs(timings: WordTiming[], fromToken: number | null): number {
  if (fromToken === null) return 0;
  let best: WordTiming | null = null;
  for (const t of timings) if (t.i >= fromToken && (!best || t.i < best.i)) best = t;
  return best?.s ?? 0;
}

export type MediaShortcut = "toggle" | "replay" | "previous" | "next";

const SHORTCUTS: Record<string, MediaShortcut> = { " ": "toggle", r: "replay", "[": "previous", "]": "next" };

/** Space plays/pauses, R replays the sentence, [ and ] step between sentences. */
export function mediaShortcut(key: string): MediaShortcut | null {
  return SHORTCUTS[key.toLowerCase()] ?? null;
}
