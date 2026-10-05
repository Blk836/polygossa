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
  { code: "es", name: "Spanish", native: "Español", speechLocale: "es-ES", cjk: false },
  { code: "fr", name: "French", native: "Français", speechLocale: "fr-FR", cjk: false },
  { code: "de", name: "German", native: "Deutsch", speechLocale: "de-DE", cjk: false },
  { code: "it", name: "Italian", native: "Italiano", speechLocale: "it-IT", cjk: false },
  { code: "pt", name: "Portuguese", native: "Português", speechLocale: "pt-PT", cjk: false },
  { code: "ja", name: "Japanese", native: "日本語", speechLocale: "ja-JP", cjk: true },
  { code: "zh", name: "Chinese", native: "中文", speechLocale: "zh-CN", cjk: true },
  { code: "ko", name: "Korean", native: "한국어", speechLocale: "ko-KR", cjk: true },
];

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

export function languageName(code: string | null | undefined): string {
  return LANGUAGES.find((l) => l.code === code)?.name ?? code ?? "";
}

export function languageInfo(code: string): LanguageInfo | undefined {
  return LANGUAGES.find((l) => l.code === code);
}
