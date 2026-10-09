import type { KnownStats, ReadingProgress } from "./types";

export type DifficultyBand = "easy" | "stretch" | "hard";

const BAND_LABELS: Record<DifficultyBand, string> = { easy: "Easy", stretch: "Stretch", hard: "Hard" };

export function bandFor(newPercent: number): DifficultyBand {
  if (newPercent <= 2) return "easy";
  return newPercent <= 10 ? "stretch" : "hard";
}

export interface Difficulty {
  text: string;
  band: DifficultyBand;
  label: string;
  title: string;
}

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
  percent: number;
  label: string;
}

export function readingProgress(progress: ReadingProgress | undefined): ProgressView | null {
  if (!progress) return null;
  if (progress.completed) return { finished: true, percent: 100, label: "Finished" };
  const percent = Math.max(0, Math.min(100, progress.percent));
  return { finished: false, percent, label: percent === 0 ? "Started" : `${percent}% read` };
}
