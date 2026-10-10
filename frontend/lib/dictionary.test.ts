import { describe, expect, it } from "vitest";
import { browserNativeLanguage, dictionaryLinks, meaningLine, meaningNote, NATIVE_LANGUAGES, savedMeaning } from "./dictionary";
import type { WordLookup } from "./types";

const base: WordLookup = { term: "maison", language: "fr", meanings: ["house", "home"], meaningLanguage: "en", source: "machine" };

describe("meaningLine", () => {
  it("names the language and lists the meanings", () => {
    expect(meaningLine(base)).toEqual({ label: "English", text: "house, home", missing: false });
    expect(meaningLine({ ...base, meaningLanguage: "es", meanings: ["casa"] })).toEqual({ label: "Spanish", text: "casa", missing: false });
  });

  it("says when there is no meaning yet", () => {
    expect(meaningLine({ ...base, meanings: [], source: null })).toEqual({ label: "English", text: "No English meaning yet", missing: true });
  });

  it("is nothing when reading my own language", () => {
    expect(meaningLine({ ...base, meanings: [], meaningLanguage: null, source: null })).toBeNull();
  });

  it("falls back to the code for a language it doesn't know", () => {
    expect(meaningLine({ ...base, meaningLanguage: "zz" })?.label).toBe("zz");
  });
});

describe("meaningNote", () => {
  it("says where the meanings came from", () => {
    expect(meaningNote({ ...base, source: "community" })).toBe("saved by other learners");
    expect(meaningNote({ ...base, source: "machine" })).toBe("machine translation");
    expect(meaningNote({ ...base, source: "sentence" })).toBe("in this sentence");
  });

  it("is nothing without meanings", () => {
    expect(meaningNote({ ...base, meanings: [], source: null })).toBeNull();
    expect(meaningNote({ ...base, meanings: [], source: "machine" })).toBeNull();
  });
});

describe("savedMeaning", () => {
  it("is the first meaning shown", () => {
    expect(savedMeaning(base)).toBe("house");
  });

  it("is nothing when none was shown", () => {
    expect(savedMeaning({ ...base, meanings: [] })).toBeUndefined();
    expect(savedMeaning(null)).toBeUndefined();
  });
});

describe("dictionaryLinks", () => {
  it("links Google Translate, DeepL and WordReference for French to English", () => {
    expect(dictionaryLinks("fr", "en", "maison")).toEqual([
      { name: "Google Translate", url: "https://translate.google.com/?sl=fr&tl=en&text=maison&op=translate" },
      { name: "DeepL", url: "https://www.deepl.com/translator#fr/en/maison" },
      { name: "WordReference", url: "https://www.wordreference.com/fren/maison" },
    ]);
  });

  it("encodes the word or phrase", () => {
    const [google, deepl, wordReference] = dictionaryLinks("fr", "en", "tout à fait");
    expect(google.url).toBe("https://translate.google.com/?sl=fr&tl=en&text=tout%20%C3%A0%20fait&op=translate");
    expect(deepl.url).toBe("https://www.deepl.com/translator#fr/en/tout%20%C3%A0%20fait");
    expect(wordReference.url).toBe("https://www.wordreference.com/fren/tout%20%C3%A0%20fait");
  });

  it.each([
    ["es", "fr"], ["fr", "es"], ["it", "pt"], ["de", "it"], ["pt", "en"], ["en", "de"],
    ["en", "nl"], ["en", "sv"], ["en", "ru"], ["en", "pl"], ["en", "tr"], ["en", "ar"], ["en", "ja"], ["en", "zh"], ["en", "ko"],
  ])("has WordReference for %s to %s", (from, to) => {
    expect(dictionaryLinks(from, to, "x").map((l) => l.name)).toContain("WordReference");
  });

  it.each([["fr", "tr"], ["de", "nl"], ["en", "vi"], ["en", "hi"], ["en", "uk"], ["en", "id"], ["es", "ja"]])(
    "has no WordReference for %s to %s, only Google Translate and DeepL",
    (from, to) => {
      expect(dictionaryLinks(from, to, "x").map((l) => l.name)).toEqual(["Google Translate", "DeepL"]);
    },
  );

  it("translates into English when reading my own language", () => {
    expect(dictionaryLinks("fr", "fr", "maison").map((l) => l.url)).toEqual([
      "https://translate.google.com/?sl=fr&tl=en&text=maison&op=translate",
      "https://www.deepl.com/translator#fr/en/maison",
      "https://www.wordreference.com/fren/maison",
    ]);
  });

  it("translates into Spanish for an English speaker reading English", () => {
    expect(dictionaryLinks("en", "en", "house")[0].url).toBe("https://translate.google.com/?sl=en&tl=es&text=house&op=translate");
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
