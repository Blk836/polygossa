import type { LanguageCode } from "./types";

export interface LanguageInfo {
  code: LanguageCode;
  name: string;
  native: string;
  speechLocale: string;
  /** Scripts without spaces between words: phrase matching works on raw characters. */
  cjk: boolean;
}

export const LANGUAGES: LanguageInfo[] = [
  { code: "en", name: "English", native: "English", speechLocale: "en-US", cjk: false },
  { code: "es", name: "Spanish", native: "Español", speechLocale: "es-ES", cjk: false },
  { code: "fr", name: "French", native: "Français", speechLocale: "fr-FR", cjk: false },
  { code: "de", name: "German", native: "Deutsch", speechLocale: "de-DE", cjk: false },
  { code: "it", name: "Italian", native: "Italiano", speechLocale: "it-IT", cjk: false },
  { code: "pt", name: "Portuguese", native: "Português", speechLocale: "pt-PT", cjk: false },
  { code: "ja", name: "Japanese", native: "日本語", speechLocale: "ja-JP", cjk: true },
  { code: "zh", name: "Chinese", native: "中文", speechLocale: "zh-CN", cjk: true },
  { code: "ko", name: "Korean", native: "한국어", speechLocale: "ko-KR", cjk: true },
];

/**
 * The languages that can be learned, for every picker. Japanese, Chinese and Korean are paused until they get real word
 * splitting (docs/acceptance/learning-languages.feature); LANGUAGES still names them for content stored in them.
 */
const PAUSED = new Set<LanguageCode>(["ja", "zh", "ko"]);
export const LEARNING_LANGUAGES: LanguageInfo[] = LANGUAGES.filter((l) => !PAUSED.has(l.code));

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function languageName(code: string | null | undefined): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code ?? "";
}

export function languageInfo(code: string): LanguageInfo | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
