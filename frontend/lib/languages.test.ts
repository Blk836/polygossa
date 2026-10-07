import { describe, expect, it } from "vitest";
import { languageInfo, languageName, LANGUAGES } from "./languages";

describe("LANGUAGES", () => {
  it("offers nine languages, English first", () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(["en", "es", "fr", "de", "it", "pt", "ja", "zh", "ko"]);
  });

  it("English is space-delimited, spoken as en-US", () => {
    expect(languageInfo("en")).toEqual({ code: "en", name: "English", native: "English", speechLocale: "en-US", cjk: false });
  });

  it("names a code, or echoes an unknown one", () => {
    expect(languageName("en")).toBe("English");
    expect(languageName("xx")).toBe("xx");
    expect(languageName(null)).toBe("");
  });
});
