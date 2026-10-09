// Meanings in the learner's own language: the native-language setting's choices, the word popup's meaning line, what a
// saved word keeps, and links out to dictionaries (lingq-style-lookup.feature). Pure helpers, unit-tested.
import type { WordLookup } from "./types";

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

function languageLabel(code: string): string {
  return NATIVE_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

/** The popup's meaning line, or null when the learner is reading their own language (nothing to translate). */
export function meaningLine(lookup: WordLookup): { label: string; text: string; missing: boolean } | null {
  if (!lookup.meaningLanguage) return null;
  const label = languageLabel(lookup.meaningLanguage);
  if (lookup.meanings.length === 0) return { label, text: `No ${label} meaning yet`, missing: true };
  return { label, text: lookup.meanings.join(", "), missing: false };
}

/** Where the meanings came from: other learners, or a machine. */
export function meaningNote(lookup: WordLookup): string | null {
  if (lookup.meanings.length === 0) return null;
  if (lookup.source === "community") return "saved by other learners";
  if (lookup.source === "machine") return "machine translation";
  return null;
}

/** The own-language meaning a saved word keeps: the first one shown. */
export function savedMeaning(lookup: WordLookup | null): string | undefined {
  return lookup?.meanings[0];
}

/** WordReference's dictionaries between two of these, either way round. */
const WORD_REFERENCE_CORE = ["en", "es", "fr", "it", "pt", "de"];
/** And its English dictionaries for these, either way round. */
const WORD_REFERENCE_ENGLISH = ["nl", "sv", "ru", "pl", "tr", "ar", "ja", "zh", "ko"];

function hasWordReference(from: string, to: string): boolean {
  if (WORD_REFERENCE_CORE.includes(from) && WORD_REFERENCE_CORE.includes(to)) return true;
  return (from === "en" && WORD_REFERENCE_ENGLISH.includes(to)) || (to === "en" && WORD_REFERENCE_ENGLISH.includes(from));
}

/**
 * Full dictionaries on their own websites, from the text's language into the learner's (into English when they are
 * reading their own language, or Spanish for English read by an English speaker): Google Translate and DeepL always,
 * WordReference where it has the pair.
 */
export function dictionaryLinks(language: string, nativeLanguage: string, term: string): { name: string; url: string }[] {
  const to = nativeLanguage !== language ? nativeLanguage : language === "en" ? "es" : "en";
  const word = encodeURIComponent(term);
  const links = [
    { name: "Google Translate", url: `https://translate.google.com/?sl=${language}&tl=${to}&text=${word}&op=translate` },
    { name: "DeepL", url: `https://www.deepl.com/translator#${language}/${to}/${word}` },
  ];
  if (hasWordReference(language, to)) links.push({ name: "WordReference", url: `https://www.wordreference.com/${language}${to}/${word}` });
  return links;
}
