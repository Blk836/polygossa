const DAY_SECONDS = 86_400;

export interface HeaderStats {
  current: number;
  best: number;
  activeToday: boolean;
  secondsLeftToday: number;
  knownWords: number;
  knownBaseWords: number;
}

export type HoneyJar = "all_forms" | "base_words";

export function jarCount(stats: Pick<HeaderStats, "knownWords" | "knownBaseWords">, jar: HoneyJar): number {
  return jar === "base_words" ? stats.knownBaseWords : stats.knownWords;
}

export interface Flame {
  state: "lit" | "fading" | "out";
  fuel: number;
  label: string;
}

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

export function knownWords(n: number, jar: HoneyJar): { text: string; label: string } {
  const text = n.toLocaleString("en-US");
  const words = n === 1 ? "word" : "words";
  return { text, label: jar === "base_words" ? `${text} known base ${words}` : `${text} known ${words} (all forms)` };
}
