import { describe, expect, it } from "vitest";
import type { Token, WordStatus } from "@/lib/types";
import { wordClass, type WordMarks } from "./word-class";

const token = (index: number, normalized = `w${index}`): Token =>
  ({ index, text: normalized, normalized, word: true, sentence: 0 }) as Token;

const marks = (over: Partial<WordMarks> = {}): WordMarks => ({
  statuses: {},
  sel: null,
  active: null,
  sentence: null,
  phrases: new Map<number, WordStatus>(),
  ...over,
});

describe("wordClass", () => {
  it("marks a word with no status as new", () => {
    expect(wordClass(token(4), marks())).toBe("w w-new");
  });

  it.each(["learning", "known", "ignored"] as const)("uses the %s status instead of new", (status) => {
    expect(wordClass(token(4), marks({ statuses: { w4: status } }))).toBe(`w w-${status}`);
  });

  it("looks the status up by the normalized form", () => {
    expect(wordClass(token(2, "casa"), marks({ statuses: { casa: "known", w2: "learning" } }))).toBe("w w-known");
  });

  it("adds the selection only inside the selected range, ends included", () => {
    const sel = { start: 3, end: 5 };
    expect(wordClass(token(2), marks({ sel }))).toBe("w w-new");
    expect(wordClass(token(3), marks({ sel }))).toBe("w w-new w-selected");
    expect(wordClass(token(5), marks({ sel }))).toBe("w w-new w-selected");
    expect(wordClass(token(6), marks({ sel }))).toBe("w w-new");
  });

  it("adds speaking only to the active word", () => {
    expect(wordClass(token(7), marks({ active: 7 }))).toBe("w w-new w-speaking");
    expect(wordClass(token(8), marks({ active: 7 }))).toBe("w w-new");
  });

  it("tints every word of the sentence being spoken, and no other", () => {
    const inSentence = { ...token(3), sentence: 2 };
    const outside = { ...token(4), sentence: 3 };
    expect(wordClass(inSentence, marks({ sentence: 2 }))).toBe("w w-new s-spoken");
    expect(wordClass(outside, marks({ sentence: 2 }))).toBe("w w-new");
    expect(wordClass({ ...token(5), sentence: 0 }, marks({ sentence: null }))).toBe("w w-new");
    expect(wordClass({ ...token(6), sentence: 0 }, marks({ sentence: 0 }))).toBe("w w-new s-spoken");
  });

  it("underlines only phrases being learned", () => {
    const phrases = new Map<number, WordStatus>([[1, "learning"], [2, "known"], [3, "ignored"]]);
    expect(wordClass(token(1), marks({ phrases }))).toBe("w w-new p-learning");
    expect(wordClass(token(2), marks({ phrases }))).toBe("w w-new");
    expect(wordClass(token(3), marks({ phrases }))).toBe("w w-new");
    expect(wordClass(token(4), marks({ phrases }))).toBe("w w-new");
  });

  it("combines everything in a stable order", () => {
    const m = marks({
      statuses: { w1: "learning" },
      sel: { start: 1, end: 1 },
      active: 1,
      phrases: new Map<number, WordStatus>([[1, "learning"]]),
    });
    expect(wordClass(token(1), m)).toBe("w w-learning w-selected w-speaking p-learning");
  });

  it("places the sentence tint after speaking and before the phrase underline", () => {
    const m = marks({ active: 1, sentence: 0, phrases: new Map<number, WordStatus>([[1, "learning"]]) });
    expect(wordClass(token(1), m)).toBe("w w-new w-speaking s-spoken p-learning");
  });
});
