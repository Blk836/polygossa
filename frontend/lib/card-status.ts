import type { KnownStats, ReadingProgress } from "./types";

// What Library and Explore cards say about an item for this reader: how hard it is (the share of its words that are
// new to them) and how far they have read it.

export type DifficultyBand = "easy" | "stretch" | "hard";

const BAND_LABELS: Record<DifficultyBand, string> = { easy: "Easy", stretch: "Stretch", hard: "Hard" };

/**
 * Reading research puts comfortable reading at about 98% known words and the useful limit near 90–95%, so up to 2%
 * new is easy, up to 10% a stretch, and more is hard.
 */
export function bandFor(newPercent: number): DifficultyBand {
  if (newPercent <= 2) return "easy";
  return newPercent <= 10 ? "stretch" : "hard";
}

export interface Difficulty {
  /** "7% new words" */
  text: string;
  band: DifficultyBand;
  label: string;
  /** Hover text with the counts behind the percentage. */
  title: string;
}

/** Null until the item has words (a video whose captions aren't in yet). Learning words don't count as new. */
export function difficulty(stats: KnownStats | undefined): Difficulty | null {
  if (!stats || stats.uniqueWords === 0) return null;
  const pct = Math.round((stats.unseen / stats.uniqueWords) * 100);
  const band = bandFor(pct);
  const shown = pct === 0 && stats.unseen > 0 ? "<1" : String(pct);
  const known = stats.known + stats.ignored;
  const noun = stats.uniqueWords === 1 ? "unique word is" : "unique words are";
  return {
    text: `${shown}% new words`,
    band,
    label: BAND_LABELS[band],
    title: `${stats.unseen.toLocaleString("en")} of ${stats.uniqueWords.toLocaleString("en")} ${noun} new to you (${known.toLocaleString("en")} known · ${stats.learning.toLocaleString("en")} learning)`,
  };
}

export interface ProgressView {
  finished: boolean;
  /** 0–100, for the bar along the cover. */
  percent: number;
  label: string;
}

/** Null for an item never opened; otherwise the bar to draw, or "Finished" once the lesson was finished. */
export function readingProgress(progress: ReadingProgress | undefined): ProgressView | null {
  if (!progress) return null;
  if (progress.completed) return { finished: true, percent: 100, label: "Finished" };
  const percent = Math.max(0, Math.min(100, progress.percent));
  return { finished: false, percent, label: percent === 0 ? "Started" : `${percent}% read` };
}
