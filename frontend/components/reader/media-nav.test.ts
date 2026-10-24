import { describe, expect, it } from "vitest";
import { cueMs, holdAt, loopRestart, mediaShortcut, segmentAt, sentenceStart, spokenAt, SPEEDS } from "./media-nav";
import type { Segment } from "./audio-sync";

const segments: Segment[] = [
  { sentence: 0, start: 1000, end: 4000 },
  { sentence: 1, start: 4000, end: 9000 },
  { sentence: 2, start: 9000, end: 12000 },
];

describe("segmentAt", () => {
  it("finds the sentence playing at a time", () => {
    expect(segmentAt(segments, 1000)).toBe(0);
    expect(segmentAt(segments, 3999)).toBe(0);
    expect(segmentAt(segments, 4000)).toBe(1);
    expect(segmentAt(segments, 11999)).toBe(2);
  });

  it("treats silence before the first sentence as the first, and time past the end as the last", () => {
    expect(segmentAt(segments, 0)).toBe(0);
    expect(segmentAt(segments, 50000)).toBe(2);
  });

  it("returns -1 when there are no sentences", () => {
    expect(segmentAt([], 1000)).toBe(-1);
  });
});

describe("sentenceStart", () => {
  it("replays the current sentence from its start", () => {
    expect(sentenceStart(segments, 6000, 0)).toBe(4000);
    expect(sentenceStart(segments, 0, 0)).toBe(1000);
  });

  it("goes to the previous and next sentences", () => {
    expect(sentenceStart(segments, 6000, -1)).toBe(1000);
    expect(sentenceStart(segments, 6000, 1)).toBe(9000);
    expect(sentenceStart(segments, 4000, -1)).toBe(1000);
  });

  it("stays at the first sentence going back and stops at the last going forward", () => {
    expect(sentenceStart(segments, 2000, -1)).toBe(1000);
    expect(sentenceStart(segments, 10000, 1)).toBeNull();
  });

  it("returns null without sentences", () => {
    expect(sentenceStart([], 0, 0)).toBeNull();
    expect(sentenceStart([], 0, 1)).toBeNull();
  });
});

describe("loopRestart", () => {
  const looped = segments[1];

  it("jumps back to the start once playback reaches the end of the looped sentence", () => {
    expect(loopRestart(looped, 9000)).toBe(4000);
    expect(loopRestart(looped, 9500)).toBe(4000);
  });

  it("does nothing inside the sentence", () => {
    expect(loopRestart(looped, 4000)).toBeNull();
    expect(loopRestart(looped, 8999)).toBeNull();
  });

  it("does nothing when nothing is looped", () => {
    expect(loopRestart(null, 9000)).toBeNull();
  });

  it("jumps back if the listener seeks before the looped sentence", () => {
    expect(loopRestart(looped, 1000)).toBe(4000);
  });
});

describe("mediaShortcut", () => {
  it("maps the playback keys", () => {
    expect(mediaShortcut(" ")).toBe("toggle");
    expect(mediaShortcut("r")).toBe("replay");
    expect(mediaShortcut("R")).toBe("replay");
    expect(mediaShortcut("[")).toBe("previous");
    expect(mediaShortcut("]")).toBe("next");
  });

  it("ignores every other key, including the word-status keys", () => {
    for (const key of ["l", "k", "i", "x", "1", "Enter", "ArrowLeft", "Escape", "a"]) expect(mediaShortcut(key)).toBeNull();
  });
});

describe("SPEEDS", () => {
  it("offers slower and faster playback around normal speed", () => {
    expect(SPEEDS).toContain(1);
    expect(Math.min(...SPEEDS)).toBeLessThan(1);
    expect(Math.max(...SPEEDS)).toBeGreaterThan(1);
    expect([...SPEEDS].sort((a, b) => a - b)).toEqual([...SPEEDS]);
  });
});

describe("cueMs", () => {
  const timings = [
    { i: 8, s: 9000, e: 9500 },
    { i: 0, s: 1000, e: 1500 },
    { i: 4, s: 5000, e: 5500 },
    { i: 2, s: 3000, e: 3500 },
  ];

  it("is 0:00 without a page to cue (page 1)", () => {
    expect(cueMs(timings, null)).toBe(0);
  });

  it("is the start of the page's first word", () => {
    expect(cueMs(timings, 2)).toBe(3000);
    expect(cueMs(timings, 4)).toBe(5000);
    expect(cueMs(timings, 0)).toBe(1000);
  });

  it("skips to the next timed word when the page starts on an untimed one", () => {
    expect(cueMs(timings, 5)).toBe(9000);
    expect(cueMs(timings, 6)).toBe(9000);
  });

  it("picks the nearest following word by position, not by time", () => {
    expect(cueMs([{ i: 9, s: 100, e: 200 }, { i: 7, s: 800, e: 900 }], 6)).toBe(800);
  });

  it("is 0:00 when no word from there on is timed", () => {
    expect(cueMs(timings, 9)).toBe(0);
    expect(cueMs([], 4)).toBe(0);
  });
});

describe("spokenAt", () => {
  const words = [
    { i: 0, s: 1000, e: 3500 },
    { i: 2, s: 4000, e: 8500 },
    { i: 4, s: 9000, e: 11000 },
  ];

  it("gives the word and the sentence being spoken", () => {
    expect(spokenAt(words, segments, 1000)).toEqual({ token: 0, sentence: 0 });
    expect(spokenAt(words, segments, 4200)).toEqual({ token: 2, sentence: 1 });
    expect(spokenAt(words, segments, 9000)).toEqual({ token: 4, sentence: 2 });
  });

  it("keeps the sentence through a pause between its words, while the word marker lets go", () => {
    expect(spokenAt(words, segments, 3950)).toEqual({ token: null, sentence: 0 });
    expect(spokenAt(words, segments, 8950)).toEqual({ token: null, sentence: 1 });
  });

  it("has no sentence before speech starts or once it has ended", () => {
    expect(spokenAt(words, segments, 999)).toEqual({ token: null, sentence: null });
    expect(spokenAt(words, segments, 11400)).toEqual({ token: 4, sentence: 2 });
    expect(spokenAt(words, segments, 11401)).toEqual({ token: null, sentence: null });
  });

  it("has nothing without timings", () => {
    expect(spokenAt([], [], 1000)).toEqual({ token: null, sentence: null });
  });
});

describe("holdAt", () => {
  it("holds just before the end of the sentence that was playing once playback crosses it", () => {
    expect(holdAt(segments, 1, 9000)).toBe(8999);
    expect(holdAt(segments, 1, 9030)).toBe(8999);
  });

  it("does nothing inside the sentence", () => {
    expect(holdAt(segments, 1, 4000)).toBeNull();
    expect(holdAt(segments, 1, 8998)).toBeNull();
  });

  it("does nothing after a jump far past the sentence, or with no sentence playing", () => {
    expect(holdAt(segments, 0, 11000)).toBeNull();
    expect(holdAt(segments, -1, 4000)).toBeNull();
    expect(holdAt([], 0, 4000)).toBeNull();
  });
});
