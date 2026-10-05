import { describe, expect, it } from "vitest";
import { bandFor, difficulty, readingProgress } from "./card-status";
import type { KnownStats } from "./types";

function stats(uniqueWords: number, unseen: number, rest: Partial<KnownStats> = {}): KnownStats {
  return { uniqueWords, unseen, known: uniqueWords - unseen, learning: 0, ignored: 0, knownPercent: 0, ...rest };
}

describe("bandFor", () => {
  it.each([
    [0, "easy"],
    [1, "easy"],
    [2, "easy"],
    [3, "stretch"],
    [10, "stretch"],
    [11, "hard"],
    [100, "hard"],
  ] as const)("%i percent new words is %s", (pct, band) => {
    expect(bandFor(pct)).toBe(band);
  });
});

describe("difficulty", () => {
  it("is nothing without stats or words", () => {
    expect(difficulty(undefined)).toBeNull();
    expect(difficulty(stats(0, 0))).toBeNull();
  });

  it("shows the share of unseen words, its band and the breakdown", () => {
    const d = difficulty(stats(1000, 70, { known: 812, learning: 40, ignored: 78 }))!;
    expect(d.text).toBe("7% new words");
    expect(d.band).toBe("stretch");
    expect(d.label).toBe("Stretch");
    expect(d.title).toBe("70 of 1,000 unique words are new to you (890 known · 40 learning)");
  });

  it("rounds to a whole percent and bands the number shown", () => {
    expect(difficulty(stats(1000, 24))!).toMatchObject({ text: "2% new words", band: "easy", label: "Easy" });
    expect(difficulty(stats(1000, 25))!).toMatchObject({ text: "3% new words", band: "stretch" });
    expect(difficulty(stats(1000, 104))!).toMatchObject({ text: "10% new words", band: "stretch" });
    expect(difficulty(stats(1000, 105))!).toMatchObject({ text: "11% new words", band: "hard", label: "Hard" });
  });

  it("says under 1% rather than 0% while some words are still new", () => {
    expect(difficulty(stats(1000, 4))!.text).toBe("<1% new words");
    expect(difficulty(stats(1000, 0))!.text).toBe("0% new words");
  });

  it("does not count learning words as new", () => {
    expect(difficulty(stats(10, 0, { known: 5, learning: 5 }))!.text).toBe("0% new words");
  });

  it("is hard when every word is new", () => {
    expect(difficulty(stats(3, 3))!).toMatchObject({ text: "100% new words", band: "hard" });
  });

  it("uses the singular for one word", () => {
    expect(difficulty(stats(1, 1, { known: 0 }))!.title).toBe("1 of 1 unique word is new to you (0 known · 0 learning)");
  });
});

describe("readingProgress", () => {
  it("is nothing for an item never opened", () => {
    expect(readingProgress(undefined)).toBeNull();
  });

  it("shows the percent read", () => {
    expect(readingProgress({ position: 840, percent: 42, completed: false })).toEqual({ finished: false, percent: 42, label: "42% read" });
  });

  it("shows a sliver for an item opened but not yet past its first page", () => {
    const p = readingProgress({ position: 0, percent: 0, completed: false })!;
    expect(p).toEqual({ finished: false, percent: 0, label: "Started" });
  });

  it("is finished once completed, whatever the percent", () => {
    expect(readingProgress({ position: 3, percent: 40, completed: true })).toEqual({ finished: true, percent: 100, label: "Finished" });
  });

  it("never goes past 100% or below 0%", () => {
    expect(readingProgress({ position: 9, percent: 140, completed: false })!.percent).toBe(100);
    expect(readingProgress({ position: 9, percent: -5, completed: false })!.percent).toBe(0);
  });
});
