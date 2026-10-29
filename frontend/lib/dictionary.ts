import type { WordLookup, WordType } from "./types";

export interface NativeLanguage {
  code: string;
  name: string;
  nativeName: string;
}

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

export function browserNativeLanguage(tag: string | undefined): string {
  const base = (tag ?? "").split(/[-_]/)[0].toLowerCase();
  return NATIVE_LANGUAGES.some((l) => l.code === base) ? base : "en";
}

function languageLabel(code: string): string {
  return NATIVE_LANGUAGES.find((l) => l.code === code)?.name ?? code;
}

export type MeaningView =
  | { missing: true; text: string }
  | { missing: false; headline: string; also: string[]; note: string | null };

export function meaningView(lookup: WordLookup): MeaningView | null {
  if (!lookup.meaningLanguage) return null;
  const [headline, ...also] = lookup.meanings;
  if (headline === undefined) return { missing: true, text: `No ${languageLabel(lookup.meaningLanguage)} meaning yet` };
  return { missing: false, headline, also, note: meaningNote(lookup) };
}

export function withMeaningFirst(lookup: WordLookup, meaning: string): WordLookup {
  return { ...lookup, meanings: [meaning, ...lookup.meanings.filter((m) => m !== meaning)] };
}

export function meaningNote(lookup: WordLookup): string | null {
  if (lookup.meanings.length === 0) return null;
  if (lookup.source === "community") return "saved by other learners";
  if (lookup.source === "sentence") return "in this sentence";
  return null;
}

export function savedMeaning(lookup: WordLookup | null): string | undefined {
  return lookup?.meanings[0];
}

export function wordTypeLine(type: WordType | null | undefined): string | null {
  if (!type) return null;
  return [type.partOfSpeech, type.form, type.lemma && `from ${type.lemma}`].filter(Boolean).join(" · ");
}

const WORD_REFERENCE_CORE = ["en", "es", "fr", "it", "pt", "de"];
const WORD_REFERENCE_ENGLISH = ["nl", "sv", "ru", "pl", "tr", "ar", "ja", "zh", "ko"];

function hasWordReference(from: string, to: string): boolean {
  if (WORD_REFERENCE_CORE.includes(from) && WORD_REFERENCE_CORE.includes(to)) return true;
  return (from === "en" && WORD_REFERENCE_ENGLISH.includes(to)) || (to === "en" && WORD_REFERENCE_ENGLISH.includes(from));
}

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
