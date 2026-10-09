import type { WordTiming } from "@/lib/types";

export const SLIDE_MS = 140;
export const HOP_MS = 160;
export const FADE_MS = 150;
export const MARKER_GAP_PX = 3;
const SAME_LINE_PX = 2.5;

export interface Box {
  left: number;
  top: number;
  width: number;
}

export interface MoveInput {
  from: Box | null;
  to: Box | null;
  adjacent: boolean;
  budgetMs: number;
  reducedMotion: boolean;
}

export type Move =
  | { kind: "none" }
  | { kind: "place" }
  | { kind: "slide" | "hop" | "show" | "hide"; ms: number };

export function planMove({ from, to, adjacent, budgetMs, reducedMotion }: MoveInput): Move {
  if (!to) return from ? { kind: "hide", ms: reducedMotion ? 0 : FADE_MS } : { kind: "none" };
  if (reducedMotion) return { kind: "place" };
  if (!from) return { kind: "show", ms: FADE_MS };
  if (budgetMs <= 0) return { kind: "place" };
  const sameLine = Math.abs(from.top - to.top) < SAME_LINE_PX;
  if (adjacent && sameLine) return { kind: "slide", ms: Math.min(SLIDE_MS, budgetMs) };
  return { kind: "hop", ms: Math.min(HOP_MS, budgetMs) };
}

export function markerBox(word: { left: number; bottom: number; width: number }, container: { left: number; top: number }): Box {
  return { left: word.left - container.left, top: word.bottom - container.top + MARKER_GAP_PX, width: word.width };
}

export function slideBudgets(timings: WordTiming[]): Map<number, number> {
  const sorted = [...timings].sort((a, b) => a.s - b.s);
  return new Map(sorted.map((t, k) => [t.i, k + 1 < sorted.length ? sorted[k + 1].s - t.s : Infinity]));
}
