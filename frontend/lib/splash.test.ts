import { describe, expect, it } from "vitest";
import type { DemoToken } from "./landing";
import { DEMOS } from "./landing-demos";
import { LEARNING_LANGUAGES } from "./languages";
import { PAUSE_STEPS, lastStep, nextSplash, splashFrame, splashOrder, splashTokens } from "./splash";

// "Hola" new, ", " punctuation, "amigo" known, "mar" new.
const TOKENS: DemoToken[] = [
  { text: "Hola", word: { meaning: "hello", pos: "interjection" } },
  { text: ", " },
  { text: "amigo", word: { meaning: "friend", pos: "noun", known: true } },
  { text: "mar", word: { meaning: "sea", pos: "noun" } },
];

describe("splashOrder", () => {
  const codes = LEARNING_LANGUAGES.map((l) => l.code);

  it("is every learnable language, starting with English by default", () => {
    expect(splashOrder()).toEqual(codes);
    expect(splashOrder(null)).toEqual(codes);
    expect(splashOrder("xx")).toEqual(codes);
    expect(splashOrder("ja")).toEqual(codes);
  });

  it("starts with the language picked, then carries on round the list", () => {
    expect(splashOrder("fr")).toEqual(["fr", "de", "it", "pt", "en", "es"]);
    expect(splashOrder("pt")).toEqual(["pt", "en", "es", "fr", "de", "it"]);
  });

  it("never includes the paused languages", () => {
    expect(splashOrder("fr")).not.toContain("ja");
    expect(splashOrder()).toHaveLength(6);
  });
});

describe("splashTokens", () => {
  it("are the landing page's demo sentence for the language", () => {
    expect(splashTokens("fr")).toBe(DEMOS.fr);
  });
});

describe("splashFrame", () => {
  it("starts with new words blue, known words plain, and the first new word tapped", () => {
    expect(splashFrame(TOKENS, 0)).toEqual({ statuses: ["new", null, "known", "new"], glossed: 0, known: 1, total: 3, done: false });
  });

  it("taps one new word at a time: gloss, then learning, then known as the next is tapped", () => {
    expect(splashFrame(TOKENS, 1)).toEqual({ statuses: ["learning", null, "known", "new"], glossed: 0, known: 1, total: 3, done: false });
    expect(splashFrame(TOKENS, 2)).toEqual({ statuses: ["known", null, "known", "new"], glossed: 3, known: 2, total: 3, done: false });
    expect(splashFrame(TOKENS, 3)).toEqual({ statuses: ["known", null, "known", "learning"], glossed: 3, known: 2, total: 3, done: false });
  });

  it("ends with every word known and nothing glossed", () => {
    expect(lastStep(TOKENS)).toBe(4);
    expect(splashFrame(TOKENS, 4)).toEqual({ statuses: ["known", null, "known", "known"], glossed: null, known: 3, total: 3, done: true });
    expect(splashFrame(TOKENS, 9)).toEqual(splashFrame(TOKENS, 4));
  });

  it("counts up by one per word over a real sentence", () => {
    const tokens = DEMOS.de;
    const counts = Array.from({ length: lastStep(tokens) + 1 }, (_, s) => splashFrame(tokens, s).known);
    const total = splashFrame(tokens, 0).total;
    expect(counts[0]).toBeLessThan(total);
    expect(counts.at(-1)).toBe(total);
    for (let s = 1; s < counts.length; s++) expect(counts[s] - counts[s - 1]).toBeGreaterThanOrEqual(0);
    expect(new Set(counts).size).toBe(total - counts[0] + 1);
  });
});

describe("nextSplash", () => {
  const order = splashOrder("pt");
  const tokensFor = (lang: number) => splashTokens(order[lang]);

  it("advances one step at a time", () => {
    expect(nextSplash({ lang: 0, step: 0 }, order.length, tokensFor)).toEqual({ lang: 0, step: 1 });
  });

  it("holds the finished page for a pause, then turns to the next language", () => {
    const end = lastStep(tokensFor(0));
    expect(nextSplash({ lang: 0, step: end + PAUSE_STEPS - 1 }, order.length, tokensFor)).toEqual({ lang: 0, step: end + PAUSE_STEPS });
    expect(nextSplash({ lang: 0, step: end + PAUSE_STEPS }, order.length, tokensFor)).toEqual({ lang: 1, step: 0 });
  });

  it("wraps round to the first language after the last", () => {
    const last = order.length - 1;
    const end = lastStep(tokensFor(last));
    expect(nextSplash({ lang: last, step: end + PAUSE_STEPS }, order.length, tokensFor)).toEqual({ lang: 0, step: 0 });
  });
});
