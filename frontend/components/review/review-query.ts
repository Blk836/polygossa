export type Rating = "forgot" | "hard" | "easy";

export const RATING_KEYS: Record<string, Rating> = { "1": "forgot", "2": "hard", "3": "easy" };

export function query(language: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams(extra);
  if (language) params.set("language", language);
  const s = params.toString();
  return s ? `?${s}` : "";
}
