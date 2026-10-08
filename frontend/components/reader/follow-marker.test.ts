import { describe, expect, it } from "vitest";
import { FADE_MS, HOP_MS, markerBox, planMove, SLIDE_MS, slideBudgets, type Box, type MoveInput } from "./follow-marker";

const box = (left: number, top = 20, width = 40): Box => ({ left, top, width });

const move = (over: Partial<MoveInput> = {}): MoveInput => ({
  from: box(0),
  to: box(50),
  adjacent: true,
  budgetMs: 1000,
  reducedMotion: false,
  ...over,
});

describe("planMove", () => {
  it("slides to the next word on the same line within SLIDE_MS", () => {
    expect(planMove(move())).toEqual({ kind: "slide", ms: SLIDE_MS });
    expect(SLIDE_MS).toBeLessThanOrEqual(150);
  });

  it("shortens the slide so it ends before the following word starts", () => {
    expect(planMove(move({ budgetMs: 90 }))).toEqual({ kind: "slide", ms: 90 });
    expect(planMove(move({ budgetMs: SLIDE_MS }))).toEqual({ kind: "slide", ms: SLIDE_MS });
  });

  it("places the marker at once when there is no time to slide", () => {
    expect(planMove(move({ budgetMs: 0 }))).toEqual({ kind: "place" });
    expect(planMove(move({ budgetMs: -5 }))).toEqual({ kind: "place" });
  });

  it("hops (fades out and in) across a line break instead of sliding", () => {
    expect(planMove(move({ to: box(0, 60) }))).toEqual({ kind: "hop", ms: HOP_MS });
  });

  it("treats a small difference in top as the same line", () => {
    expect(planMove(move({ to: box(50, 21.5) })).kind).toBe("slide");
    expect(planMove(move({ to: box(50, 18) })).kind).toBe("slide");
    expect(planMove(move({ to: box(50, 23) })).kind).toBe("hop");
    expect(planMove(move({ to: box(50, 17) })).kind).toBe("hop");
  });

  it("hops to a word that is not the next one (seek, step, play from here), even on the same line", () => {
    expect(planMove(move({ adjacent: false }))).toEqual({ kind: "hop", ms: HOP_MS });
  });

  it("shortens a hop to the word's budget, and places when there is none", () => {
    expect(planMove(move({ adjacent: false, budgetMs: 60 }))).toEqual({ kind: "hop", ms: 60 });
    expect(planMove(move({ adjacent: false, budgetMs: 0 }))).toEqual({ kind: "place" });
  });

  it("fades in where nothing was marked (start, after a gap, after a page turn)", () => {
    expect(planMove(move({ from: null }))).toEqual({ kind: "show", ms: FADE_MS });
  });

  it("fades out when no word is spoken", () => {
    expect(planMove(move({ to: null }))).toEqual({ kind: "hide", ms: FADE_MS });
  });

  it("does nothing when nothing was or is marked", () => {
    expect(planMove(move({ from: null, to: null }))).toEqual({ kind: "none" });
  });

  it("never animates with reduced motion", () => {
    const reduced = { reducedMotion: true };
    expect(planMove(move(reduced))).toEqual({ kind: "place" });
    expect(planMove(move({ ...reduced, adjacent: false }))).toEqual({ kind: "place" });
    expect(planMove(move({ ...reduced, from: null }))).toEqual({ kind: "place" });
    expect(planMove(move({ ...reduced, to: null }))).toEqual({ kind: "hide", ms: 0 });
  });
});

describe("markerBox", () => {
  const container = { left: 100, top: 200 };

  it("sits just under the word, as wide as it, relative to the container", () => {
    expect(markerBox({ left: 130, bottom: 250, width: 42 }, container)).toEqual({ left: 30, top: 53, width: 42 });
  });
});

describe("slideBudgets", () => {
  it("gives each word the time until the next word starts", () => {
    const budgets = slideBudgets([
      { i: 4, s: 1000, e: 1200 },
      { i: 0, s: 0, e: 300 },
      { i: 2, s: 400, e: 900 },
    ]);
    expect(budgets.get(0)).toBe(400);
    expect(budgets.get(2)).toBe(600);
    expect(budgets.get(4)).toBe(Infinity);
  });

  it("is empty without timings", () => {
    expect(slideBudgets([]).size).toBe(0);
  });
});
