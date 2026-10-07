// Native-language translations in dictionary results: the setting's choices, the popup's line and what a saved word
// keeps. Pure helpers, unit-tested.
import type { DictionaryResult } from "./types";

export interface NativeLanguage {
  code: string;
  name: string;
  nativeName: string;
}

/** The languages definitions can be translated into (kept in step with the backend's NativeLanguage). */
export const NATIVE_LANGUAGES: NativeLanguage[] = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "zh", name: "Chinese", nativeName: "中文" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
];

/** The browser's language ("pt-BR") as a native language we offer, else English. */
export function browserNativeLanguage(tag: string | undefined): string {
  const base = (tag ?? "").split(/[-_]/)[0].toLowerCase();
  return NATIVE_LANGUAGES.some((l) => l.code === base) ? base : "en";
}

/** The popup's translation line, or null when there is none to show (English speakers, words not found). */
export function translationLine(result: DictionaryResult): { label: string; text: string; missing: boolean } | null {
  if (!result.found || !result.translations || !result.translationLanguage) return null;
  const label = NATIVE_LANGUAGES.find((l) => l.code === result.translationLanguage)?.name ?? result.translationLanguage;
  if (result.translations.length === 0) return { label, text: `No ${label} translation found`, missing: true };
  return { label, text: result.translations.join(", "), missing: false };
}

/** The definition a saved word keeps: its translations first, then the first two English senses. */
export function savedDefinition(result: DictionaryResult): string {
  const english = result.senses.slice(0, 2).map((s) => s.definition).join("; ");
  const native = (result.translations ?? []).join(", ");
  return [native, english].filter(Boolean).join(" — ");
}
