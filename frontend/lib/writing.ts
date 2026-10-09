import { CEFR_LEVELS } from "./languages";

export const WRITING_LEVELS = [...CEFR_LEVELS];

const WORD = /[\p{L}\p{M}\p{N}]+/gu;
const CHARACTER = /[\p{L}\p{N}]/gu;

export function countWriting(text: string, language: string): number {
  const pattern = language === "ja" || language === "zh" ? CHARACTER : WORD;
  return text.match(pattern)?.length ?? 0;
}

export function secondsLeft(deadline: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(deadline) - now) / 1000));
}

export function formatClock(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function canHandIn(count: number, minimum: number, remaining: number): boolean {
  return count > 0 && (remaining === 0 || count >= minimum);
}

export function scoreBand(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good";
  if (score >= 40) return "Developing";
  return "Keep practising";
}
