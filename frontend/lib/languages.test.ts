import { describe, expect, it } from "vitest";
import { languageInfo, languageName, LANGUAGES } from "./languages";

describe("LANGUAGES", () => {
  it("offers nine languages, English first", () => {
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
