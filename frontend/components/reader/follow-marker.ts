// The follow-along marker's moves: a bar under the spoken word that slides to the next word on its line, hops (fades
// out and in) across a line break or a jump, and fades in or out where speech starts or stops.
import type { WordTiming } from "@/lib/types";

/** Longest slide from one word to the next. */
export const SLIDE_MS = 140;
/** A hop's fade out at the old word and in at the new one, together. */
export const HOP_MS = 160;
/** Fading in where nothing was marked, or out when speech stops. */
export const FADE_MS = 150;
/** Gap between the word's bottom and the marker, so a selected word's ring stays clear of it. */
export const MARKER_GAP_PX = 3;
/** Tops closer than this are the same line. */
const SAME_LINE_PX = 2.5;

/** Where the marker sits, relative to the text's container. */
export interface Box {
  left: number;
  top: number;
  width: number;
}

export interface MoveInput {
  /** Where the marker is now; null when hidden (start, a gap in speech, a turned page). */
  from: Box | null;
  /** Where the spoken word wants it; null when no word is spoken. */
  to: Box | null;
  /** The new word is the next word after the old one. */
  adjacent: boolean;
  /** Time until the word after the new one starts: the move must be over by then. */
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

/** The marker's box for a word's client rect, relative to the container's. */
export function markerBox(word: { left: number; bottom: number; width: number }, container: { left: number; top: number }): Box {
  return { left: word.left - container.left, top: word.bottom - container.top + MARKER_GAP_PX, width: word.width };
}

/** Token index → time from the word's start until the next word starts (Infinity for the last). */
export function slideBudgets(timings: WordTiming[]): Map<number, number> {
  const sorted = [...timings].sort((a, b) => a.s - b.s);
  return new Map(sorted.map((t, k) => [t.i, k + 1 < sorted.length ? sorted[k + 1].s - t.s : Infinity]));
}
