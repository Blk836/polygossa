import { describe, expect, it } from "vitest";
import type { Token, WordTiming } from "@/lib/types";
import { findActive, firstWordOfSentence, formatTime, sentenceSegments } from "./audio-sync";

const timings: WordTiming[] = [
  { i: 0, s: 1000, e: 1500 },
  { i: 2, s: 1600, e: 2000 },
  { i: 4, s: 5000, e: 6000 },
];

describe("findActive", () => {
  it("returns the word being spoken", () => {
    expect(findActive(timings, 1000)?.i).toBe(0);
    expect(findActive(timings, 1700)?.i).toBe(2);
    expect(findActive(timings, 5999)?.i).toBe(4);
  });

  it("keeps the last word active for 400 ms after it ends", () => {
    expect(findActive(timings, 2400)?.i).toBe(2);
    expect(findActive(timings, 2401)).toBeNull();
  });

  it("returns null before the first word and for no timings", () => {
    expect(findActive(timings, 999)).toBeNull();
    expect(findActive([], 1000)).toBeNull();
  });
});

describe("formatTime", () => {
  it("formats minutes and zero-padded seconds", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65_999)).toBe("1:05");
    expect(formatTime(-5)).toBe("0:00");
  });
});

const tokens: Token[] = [
  { index: 0, text: "Uno", word: true, normalized: "uno", sentence: 0 },
  { index: 1, text: " ", word: false, sentence: 0 },
  { index: 2, text: "dos", word: true, normalized: "dos", sentence: 0 },
  { index: 3, text: ". ", word: false, sentence: 0 },
  { index: 4, text: "Tres", word: true, normalized: "tres", sentence: 1 },
];

describe("firstWordOfSentence", () => {
  it("maps each sentence to its first word token", () => {
    expect([...firstWordOfSentence(tokens)]).toEqual([
      [0, 0],
      [1, 4],
    ]);
  });
});

describe("sentenceSegments", () => {
  it("spans from each sentence's first word to the next sentence", () => {
    expect(sentenceSegments(tokens, timings, 8000)).toEqual([
      { sentence: 0, start: 1000, end: 5000 },
      { sentence: 1, start: 5000, end: 8000 },
    ]);
  });

  it("ends the last segment at the last word when the duration is unknown", () => {
    expect(sentenceSegments(tokens, timings, 0).at(-1)).toEqual({ sentence: 1, start: 5000, end: 6000 });
  });

  it("is empty without timings", () => {
    expect(sentenceSegments(tokens, [], 8000)).toEqual([]);
  });
});

describe("sentenceSegments with messy input", () => {
  it("sorts timings and ignores timings for unknown tokens", () => {
    const shuffled: WordTiming[] = [
      { i: 4, s: 5000, e: 6000 },
      { i: 99, s: 100, e: 200 },
      { i: 2, s: 1600, e: 2000 },
      { i: 0, s: 1000, e: 1500 },
    ];
    expect(sentenceSegments(tokens, shuffled, 8000)).toEqual([
      { sentence: 0, start: 1000, end: 5000 },
      { sentence: 1, start: 5000, end: 8000 },
    ]);
  });

  it("orders segments by start time even when a later sentence plays first", () => {
    const swapped: WordTiming[] = [
      { i: 0, s: 4000, e: 4500 },
      { i: 4, s: 1000, e: 2000 },
    ];
    expect(sentenceSegments(tokens, swapped, 6000)).toEqual([
      { sentence: 1, start: 1000, end: 4000 },
      { sentence: 0, start: 4000, end: 6000 },
    ]);
  });
});
