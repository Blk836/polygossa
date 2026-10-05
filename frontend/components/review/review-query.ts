// Review queue query strings and rating keys (pure helpers, unit-tested).

export type Rating = "forgot" | "hard" | "easy";

/** Keyboard ratings after the answer is shown. */
export const RATING_KEYS: Record<string, Rating> = { "1": "forgot", "2": "hard", "3": "easy" };

/** Query string with the optional language filter. */
export function query(language: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (language) params.set("language", language);
  const s = params.toString();
  return s ? `?${s}` : "";
}
