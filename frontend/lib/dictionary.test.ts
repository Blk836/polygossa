import { describe, expect, it } from "vitest";
import { browserNativeLanguage, NATIVE_LANGUAGES, savedDefinition, translationLine } from "./dictionary";
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

describe("NATIVE_LANGUAGES", () => {
  it("starts with English and includes every learnable language", () => {
    expect(NATIVE_LANGUAGES[0]).toEqual({ code: "en", name: "English", nativeName: "English" });
    for (const code of ["es", "fr", "de", "it", "pt", "ja", "zh", "ko", "ru", "ar"]) {
      expect(NATIVE_LANGUAGES.map((l) => l.code)).toContain(code);
    }
  });
});
