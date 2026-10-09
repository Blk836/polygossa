import { describe, expect, it } from "vitest";
import {
  closeWord, demoCounts, demoSentence, initialDemoState, onboardingPath, parseLanguage, selectWord, setDemoStatus, signupHref, type DemoToken,
} from "./landing";
import { DEMOS } from "./landing-demos";
import { LANGUAGES, LEARNING_LANGUAGES } from "./languages";

describe("parseLanguage", () => {
  it.each(LEARNING_LANGUAGES.map((l) => l.code))("accepts %s", (code) => {
    expect(parseLanguage(code)).toBe(code);
  });

  it.each([null, undefined, "", "xx", "ES", " es", "english", "ja", "zh", "ko"])("rejects %j", (value) => {
    expect(parseLanguage(value)).toBeNull();
  });
});

describe("sign-up and onboarding links", () => {
  it("carry a supported language", () => {
    expect(signupHref("fr")).toBe("/signup?lang=fr");
    expect(onboardingPath("de")).toBe("/onboarding?lang=de");
  });

  it("drop a missing or unsupported language", () => {
    expect(signupHref()).toBe("/signup");
    expect(signupHref(null)).toBe("/signup");
    expect(signupHref("xx")).toBe("/signup");
    expect(signupHref("ja")).toBe("/signup");
    expect(onboardingPath(undefined)).toBe("/onboarding");
    expect(onboardingPath("xx")).toBe("/onboarding");
  });
});

const TOKENS: DemoToken[] = [
  { text: "Hola", word: { meaning: "hello", pos: "interjection" } },
  { text: ", " },
  { text: "amigo", word: { meaning: "friend", pos: "noun", known: true } },
];

describe("the demo reader", () => {
  it("starts with words new or known, nothing selected and nothing looked up", () => {
    expect(initialDemoState(TOKENS)).toEqual({ statuses: { 0: "new", 2: "known" }, selected: null, lookups: 0 });
  });

  it("opening a new word makes it learning and counts a look-up", () => {
    expect(selectWord(initialDemoState(TOKENS), 0)).toEqual({ statuses: { 0: "learning", 2: "known" }, selected: 0, lookups: 1 });
  });

  it("opening a word again, or a known word, keeps its status and doesn't count again", () => {
    const once = selectWord(initialDemoState(TOKENS), 0);
    expect(selectWord(once, 0)).toEqual(once);
    expect(selectWord(once, 2)).toEqual({ ...once, selected: 2 });
  });

  it("ignores clicks on punctuation and out-of-range tokens", () => {
    const start = initialDemoState(TOKENS);
    expect(selectWord(start, 1)).toBe(start);
    expect(selectWord(start, 9)).toBe(start);
  });

  it("sets the open word's status; with no word open it does nothing", () => {
    const start = initialDemoState(TOKENS);
    expect(setDemoStatus(start, "known")).toBe(start);
    const known = setDemoStatus(selectWord(start, 0), "known");
    expect(known.statuses).toEqual({ 0: "known", 2: "known" });
    expect(known.selected).toBe(0);
  });

  it("closing the card keeps statuses and look-ups", () => {
    const open = selectWord(initialDemoState(TOKENS), 0);
    expect(closeWord(open)).toEqual({ ...open, selected: null });
  });

  it("counts known words and the percentage known", () => {
    const start = initialDemoState(TOKENS);
    expect(demoCounts(start)).toEqual({ known: 1, total: 2, percent: 50 });
    expect(demoCounts(setDemoStatus(selectWord(start, 0), "known"))).toEqual({ known: 2, total: 2, percent: 100 });
    expect(demoCounts(initialDemoState([{ text: "!" }]))).toEqual({ known: 0, total: 0, percent: 0 });
  });

  it("rounds the percentage", () => {
    const three: DemoToken[] = [0, 1, 2].map((i) => ({ text: `w${i}`, word: { meaning: "", pos: "", known: i === 0 } }));
    expect(demoCounts(initialDemoState(three)).percent).toBe(33);
  });
});

describe("demoSentence", () => {
  it("spaces words, attaches punctuation, and carries glosses", () => {
    expect(demoSentence([["Hola", "hello", "interjection"], ",", ["amigo", "friend", "noun", { k: true }], ["mío", "mine", "pronoun"], "!"]))
      .toEqual([
        { text: "Hola", word: { meaning: "hello", pos: "interjection", reading: undefined, known: undefined } },
        { text: "," },
        { text: " " },
        { text: "amigo", word: { meaning: "friend", pos: "noun", reading: undefined, known: true } },
        { text: " " },
        { text: "mío", word: { meaning: "mine", pos: "pronoun", reading: undefined, known: undefined } },
        { text: "!" },
      ]);
  });

  it("joins without a gap when the gap is empty, keeping readings", () => {
    expect(demoSentence([["我", "I", "pronoun", { r: "wǒ" }], ["好", "good", "adjective"]], "")).toEqual([
      { text: "我", word: { meaning: "I", pos: "pronoun", reading: "wǒ", known: undefined } },
      { text: "好", word: { meaning: "good", pos: "adjective", reading: undefined, known: undefined } },
    ]);
  });

  it("adds no gap after the last word", () => {
    expect(demoSentence([["sí", "yes", "adverb"]])).toHaveLength(1);
  });
});

describe("demo sentences", () => {
  it.each(LANGUAGES.map((l) => l.code))("%s has new and known words, each glossed", (code) => {
    const words = DEMOS[code].filter((t) => t.word);
    expect(words.some((t) => t.word!.known)).toBe(true);
    expect(words.some((t) => !t.word!.known)).toBe(true);
    for (const t of words) {
      expect(t.text.trim()).toBe(t.text);
      expect(t.word!.meaning).not.toBe("");
      expect(t.word!.pos).not.toBe("");
    }
  });

  it("spaces words but not punctuation in space-separated languages", () => {
    expect(DEMOS.es.map((t) => t.text).join("")).toBe("Cada mañana, Lucía camina hasta un pequeño café cerca del mar.");
    expect(DEMOS.ko.map((t) => t.text).join("")).toBe("주말에 친구와 함께 영화를 봤어요.");
  });

  it("runs Chinese and Japanese together without spaces", () => {
    expect(DEMOS.zh.map((t) => t.text).join("")).toBe("我每天早上在公园里跑步。");
    expect(DEMOS.ja.map((t) => t.text).join("")).toBe("毎朝、私は駅の近くでコーヒーを飲みます。");
  });
});
