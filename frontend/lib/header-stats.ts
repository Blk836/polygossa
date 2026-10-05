// The header's numbers (GET /api/dashboard/header): known words, and the streak flame — lit once today's practice is
// done, burning down towards midnight while the streak is at risk, and out when there is no streak. Pure helpers.

const DAY_SECONDS = 86_400;

export interface HeaderStats {
  current: number;
  best: number;
  activeToday: boolean;
  /** Seconds until midnight in the learner's time zone. */
  secondsLeftToday: number;
  /** Known words in the language picked in the top bar (all languages when none is picked). */
  knownWords: number;
}

export interface Flame {
  state: "lit" | "fading" | "out";
  /** How much of the flame is left, 0–1. */
  fuel: number;
  /** What the flame means, for its accessible name and tooltip. */
  label: string;
}

/** Hours and minutes left, e.g. "3h 20m", "59m", or "under a minute". */
export function timeLeft(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  if (minutes < 1) return "under a minute";
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}

export function flame({ current, activeToday, secondsLeftToday }: Pick<HeaderStats, "current" | "activeToday" | "secondsLeftToday">): Flame {
  if (activeToday) return { state: "lit", fuel: 1, label: `${current}-day streak — today's done` };
  if (current === 0) return { state: "out", fuel: 0, label: "No streak yet — practise today to start one" };
  return {
    state: "fading",
    fuel: Math.min(Math.max(secondsLeftToday / DAY_SECONDS, 0), 1),
    label: `${current}-day streak — practise in the next ${timeLeft(secondsLeftToday)} to keep it`,
  };
}

/** The known-words count with thousands separated, and its accessible name. */
export function knownWords(n: number): { text: string; label: string } {
  const text = n.toLocaleString("en-US");
  return { text, label: `${text} known ${n === 1 ? "word" : "words"}` };
}
