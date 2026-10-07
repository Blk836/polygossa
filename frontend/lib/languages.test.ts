import { describe, expect, it } from "vitest";
import { languageInfo, languageName, LANGUAGES, LEARNING_LANGUAGES } from "./languages";

describe("LEARNING_LANGUAGES", () => {
  it("offers six languages to learn, English first: Japanese, Chinese and Korean are paused", () => {
    expect(LEARNING_LANGUAGES.map((l) => l.code)).toEqual(["en", "es", "fr", "de", "it", "pt"]);
  });

  it("is the same entries as LANGUAGES, so names and scripts agree", () => {
    for (const l of LEARNING_LANGUAGES) expect(LANGUAGES).toContain(l);
  });
});

describe("LANGUAGES", () => {
  it("knows nine languages, English first (content stored in a paused one still shows its name)", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["en", "es", "fr", "de", "it", "pt", "ja", "zh", "ko"]);
  });

  it("names each language, natively too, with its speech locale and script kind", () => {
    expect(LANGUAGES.map((l) => `${l.code} ${l.name} ${l.native} ${l.speechLocale} ${l.cjk}`)).toEqual([
      "en English English en-US false", "es Spanish Español es-ES false", "fr French Français fr-FR false",
      "de German Deutsch de-DE false", "it Italian Italiano it-IT false", "pt Portuguese Português pt-PT false",
      "ja Japanese 日本語 ja-JP true", "zh Chinese 中文 zh-CN true", "ko Korean 한국어 ko-KR true",
    ]);
  });

  it("English is space-delimited, spoken as en-US", () => {
    expect(languageInfo("en")).toEqual({ code: "en", name: "English", native: "English", speechLocale: "en-US", cjk: false });
  });

  it("finds a language by its code", () => {
    expect(languageInfo("ja")?.name).toBe("Japanese");
    expect(languageInfo("xx")).toBeUndefined();
  });

  it("names a code, or echoes an unknown one", () => {
    expect(languageName("en")).toBe("English");
    expect(languageName("xx")).toBe("xx");
    expect(languageName(null)).toBe("");
  });
});
