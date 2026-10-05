// Pure helpers for library items that may be texts or YouTube videos.
import type { TextSummary, Token, WordTiming } from "./types";

export type KindFilter = "all" | "text" | "video";

export const KIND_FILTERS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "text", label: "Texts" },
  { id: "video", label: "Videos" },
];

/** Adds `kind=` to an API path unless showing everything. */
export function withKind(path: string, kind: KindFilter): string {
  if (kind === "all") return path;
  return `${path}${path.includes("?") ? "&" : "?"}kind=${kind}`;
}

/** Adds `language=` to an API path, scoping lists to the language picked in the top bar (none: every language). */
export function withLanguage(path: string, language: string | null | undefined): string {
  if (!language) return path;
  return `${path}${path.includes("?") ? "&" : "?"}language=${language}`;
}

export type Reaction = "like" | "bookmark";

/** The item after the viewer toggles a like or bookmark (applied optimistically before the API call). */
export function toggleReaction(t: TextSummary, reaction: Reaction): TextSummary {
  if (reaction === "bookmark") return { ...t, bookmarked: !t.bookmarked };
  return { ...t, liked: !t.liked, likes: (t.likes ?? 0) + (t.liked ? -1 : 1) };
}

/** "3:33" or "1:02:05"; null when the length is unknown. */
export function formatVideoLength(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null;
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

const WORD_GAP_WEIGHT = 1;
const SENTENCE_PAUSE_WEIGHT = 4;
const SENTENCE_END = /[.!?…。！？\n]/;

function weight(t: Token): number {
  if (t.word) return [...t.text].length + WORD_GAP_WEIGHT;
  return SENTENCE_END.test(t.text) ? SENTENCE_PAUSE_WEIGHT : 0.3;
}

/**
 * Proportional word timings over a duration — the client-side twin of the backend's AudioAligner.estimate, used when
 * a video was imported without captions and its length only becomes known once the player loads.
 */
export function estimateTimings(tokens: Token[], durationMs: number): WordTiming[] {
  if (!(durationMs > 0)) return [];
  // Every token weighs more than zero, so total is only 0 when there are no tokens (and the loop never runs).
  const total = tokens.reduce((sum, t) => sum + weight(t), 0);
  const out: WordTiming[] = [];
  let cursor = 0;
  for (const t of tokens) {
    const s = Math.round((cursor / total) * durationMs);
    cursor += weight(t);
    if (t.word) out.push({ i: t.index, s, e: Math.round((cursor / total) * durationMs) });
  }
  return out;
}
