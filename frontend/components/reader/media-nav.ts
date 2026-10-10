import type { WordTiming } from "@/lib/types";
import { findActive, LINGER_MS, type Segment } from "./audio-sync";

export const SPEEDS = [0.5, 0.75, 0.9, 1, 1.25, 1.5] as const;

export function segmentAt(segments: Segment[], ms: number): number {
  let found = segments.length > 0 ? 0 : -1;
  for (let k = 1; k < segments.length && segments[k].start <= ms; k++) found = k;
  return found;
}

export function sentenceStart(segments: Segment[], ms: number, step: -1 | 0 | 1): number | null {
  const target = Math.max(0, segmentAt(segments, ms) + step);
  return target < segments.length ? segments[target].start : null;
}

export function loopRestart(looped: Segment | null, ms: number): number | null {
  if (!looped) return null;
  return ms >= looped.end || ms < looped.start ? looped.start : null;
}

export function cueMs(timings: WordTiming[], fromToken: number | null): number {
  if (fromToken === null) return 0;
  let best: WordTiming | null = null;
  for (const t of timings) if (t.i >= fromToken && (!best || t.i < best.i)) best = t;
  return best?.s ?? 0;
}

export type MediaShortcut = "toggle" | "replay" | "previous" | "next";

const SHORTCUTS: Record<string, MediaShortcut> = { " ": "toggle", r: "replay", "[": "previous", "]": "next" };

export function mediaShortcut(key: string): MediaShortcut | null {
  return SHORTCUTS[key.toLowerCase()] ?? null;
}

export interface Spoken {
  token: number | null;
  sentence: number | null;
}

export function spokenAt(timings: WordTiming[], segments: Segment[], ms: number): Spoken {
  const token = findActive(timings, ms)?.i ?? null;
  const end = timings.reduce((latest, t) => Math.max(latest, t.e), -Infinity) + LINGER_MS;
  const k = segmentAt(segments, ms);
  const speaking = k >= 0 && ms >= segments[0].start && ms <= end;
  return { token, sentence: speaking ? segments[k].sentence : null };
}
