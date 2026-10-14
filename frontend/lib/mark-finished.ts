import type { MediaKind, TextSummary } from "./types";

const KEEP_LEARNING = "Words you're learning keep their status.";

export function markFinishedLabel(kind: MediaKind): string {
  return kind === "video" ? "Mark as watched" : "Mark as read";
}

export function markFinishedMessage(text: TextSummary): string {
  const unseen = text.stats?.unseen;
  if (unseen === undefined) return `Its new words will be marked known. ${KEEP_LEARNING}`;
  if (unseen === 0) return "It has no new words, so no words will change. It will count as finished.";
  const words = unseen === 1 ? "new word will" : "new words will";
  return `${unseen.toLocaleString("en")} ${words} be marked known. ${KEEP_LEARNING}`;
}

export function finishedSummary(text: TextSummary, markedKnown: number): TextSummary {
  const progress = { position: text.progress?.position ?? 0, percent: 100, completed: true };
  if (!text.stats) return { ...text, progress };
  const known = text.stats.known + markedKnown;
  const { uniqueWords, ignored } = text.stats;
  const knownPercent = uniqueWords === 0 ? 0 : Math.round((1000 * (known + ignored)) / uniqueWords) / 10;
  return { ...text, progress, stats: { ...text.stats, known, unseen: 0, knownPercent } };
}
