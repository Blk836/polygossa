import { describe, expect, it } from "vitest";
import { browserNativeLanguage, hasDetails, NATIVE_LANGUAGES, savedDefinition, savedMeaning, translationLine, translationNote } from "./dictionary";
import type { DictionaryResult } from "./types";

const base: DictionaryResult = {
  term: "Hund",
  language: "de",
  found: true,
  senses: [
    { partOfSpeech: "noun", definition: "dog", examples: [] },
    { partOfSpeech: "noun", definition: "scoundrel", examples: [] },
    { partOfSpeech: "noun", definition: "third", examples: [] },
  ],
};

describe("savedDefinition", () => {
  it("is the first two English senses without translations", () => {
    expect(savedDefinition(base)).toBe("dog; scoundrel");
    expect(savedDefinition({ ...base, translations: null })).toBe("dog; scoundrel");
    expect(savedDefinition({ ...base, translations: [] })).toBe("dog; scoundrel");
  });

  it("starts with the translations, then the English gloss", () => {
    expect(savedDefinition({ ...base, translations: ["perro", "can"], translationLanguage: "es" })).toBe("perro, can — dog; scoundrel");
  });

  it("is just the translations when there are no senses", () => {
    expect(savedDefinition({ ...base, senses: [], translations: ["perro"] })).toBe("perro");
  });
});

describe("translationLine", () => {
  it("names the language and lists the translations", () => {
    expect(translationLine({ ...base, translations: ["perro", "can"], translationLanguage: "es" })).toEqual({ label: "Spanish", text: "perro, can", missing: false });
  });

  it("says when none was found", () => {
    expect(translationLine({ ...base, translations: [], translationLanguage: "es" })).toEqual({ label: "Spanish", text: "No Spanish translation found", missing: true });
  });

  it("is nothing for English speakers or a word that wasn't found", () => {
    expect(translationLine(base)).toBeNull();
    expect(translationLine({ ...base, translations: null, translationLanguage: null })).toBeNull();
    expect(translationLine({ ...base, found: false, translations: [], translationLanguage: "es" })).toBeNull();
  });

  it("falls back to the code for a language it doesn't know", () => {
    expect(translationLine({ ...base, translations: ["x"], translationLanguage: "zz" })?.label).toBe("zz");
  });

  it("shows translations of a word no dictionary has (others' meanings, machine translation)", () => {
    const notFound = { ...base, found: false, senses: [] };
    expect(translationLine({ ...notFound, translations: ["nevera"], translationLanguage: "es" })).toEqual({ label: "Spanish", text: "nevera", missing: false });
    expect(translationLine({ ...notFound, translations: ["nevera"], translationLanguage: null })).toBeNull();
  });
});

describe("translationNote", () => {
  it("says where the meanings came from", () => {
    expect(translationNote({ ...base, translations: ["perro"], translationSource: "community" })).toBe("saved by other learners");
    expect(translationNote({ ...base, translations: ["perro"], translationSource: "machine" })).toBe("machine translation");
  });

  it("is nothing for the dictionary's own translations or none at all", () => {
    expect(translationNote({ ...base, translations: ["perro"], translationSource: "dictionary" })).toBeNull();
    expect(translationNote({ ...base, translations: [], translationSource: null })).toBeNull();
    expect(translationNote(base)).toBeNull();
  });
});

describe("savedMeaning", () => {
  it("is the first meaning shown", () => {
    expect(savedMeaning({ ...base, translations: ["perro", "can"], translationLanguage: "es" })).toBe("perro");
  });

  it("is nothing when none was shown", () => {
    expect(savedMeaning(base)).toBeUndefined();
    expect(savedMeaning({ ...base, translations: [], translationLanguage: "es" })).toBeUndefined();
    expect(savedMeaning({ ...base, translations: null })).toBeUndefined();
  });
});

describe("hasDetails", () => {
  it("is true for a dictionary entry or a word with translations", () => {
    expect(hasDetails(base)).toBe(true);
    expect(hasDetails({ ...base, found: false, senses: [], translations: ["nevera"], translationLanguage: "es" })).toBe(true);
  });

  it("is false for a word nothing was found for", () => {
    expect(hasDetails({ ...base, found: false, senses: [] })).toBe(false);
    expect(hasDetails({ ...base, found: false, senses: [], translations: [], translationLanguage: "es" })).toBe(false);
    expect(hasDetails(null)).toBe(false);
  });
});

describe("browserNativeLanguage", () => {
  it.each([
    ["pt-BR", "pt"],
    ["es", "es"],
    ["ZH-tw", "zh"],
    ["fi", "en"],
    ["", "en"],
    [undefined, "en"],
  ])("%s → %s", (browser, code) => {
    expect(browserNativeLanguage(browser)).toBe(code);
  });
});

describe("NATIVE_LANGUAGES (kept in step with the backend's NativeLanguage)", () => {
  it("lists every language with its English and native name", () => {
    expect(NATIVE_LANGUAGES.map((l) => `${l.code} ${l.name} ${l.nativeName}`)).toEqual([
      "en English English", "es Spanish Español", "fr French Français", "de German Deutsch", "it Italian Italiano",
      "pt Portuguese Português", "nl Dutch Nederlands", "pl Polish Polski", "sv Swedish Svenska", "tr Turkish Türkçe",
      "vi Vietnamese Tiếng Việt", "id Indonesian Bahasa Indonesia", "ru Russian Русский", "uk Ukrainian Українська",
      "ar Arabic العربية", "hi Hindi हिन्दी", "ja Japanese 日本語", "zh Chinese 中文", "ko Korean 한국어",
    ]);
  });

  it("starts with English and includes every learnable language", () => {
    expect(NATIVE_LANGUAGES[0]).toEqual({ code: "en", name: "English", nativeName: "English" });
    for (const code of ["es", "fr", "de", "it", "pt", "ja", "zh", "ko", "ru", "ar"]) {
      expect(NATIVE_LANGUAGES.map((l) => l.code)).toContain(code);
    }
  });
});
