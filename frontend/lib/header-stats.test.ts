import { describe, expect, it } from "vitest";
import { flame, knownWords, timeLeft } from "./header-stats";

const DAY = 86_400;

describe("flame", () => {
  it("burns fully once today is done", () => {
    expect(flame({ current: 4, activeToday: true, secondsLeftToday: 600 })).toEqual({
      state: "lit",
      fuel: 1,
      label: "4-day streak — today's done",
    });
  });

  it("burns down with the day while a streak is at risk", () => {
    const f = flame({ current: 4, activeToday: false, secondsLeftToday: DAY / 4 });
    expect(f.state).toBe("fading");
    expect(f.fuel).toBe(0.25);
    expect(f.label).toBe("4-day streak — practise in the next 6h 0m to keep it");
  });

  it("is still nearly full at the start of the day", () => {
    expect(flame({ current: 1, activeToday: false, secondsLeftToday: DAY }).fuel).toBe(1);
  });

  it("never reports more fuel than a full day, even on a 25-hour day", () => {
    expect(flame({ current: 1, activeToday: false, secondsLeftToday: 25 * 3600 }).fuel).toBe(1);
  });

  it("has no fuel left at midnight", () => {
    expect(flame({ current: 2, activeToday: false, secondsLeftToday: 0 }).fuel).toBe(0);
    expect(flame({ current: 2, activeToday: false, secondsLeftToday: -30 }).fuel).toBe(0);
  });

  it("says 1-day for a one-day streak", () => {
    expect(flame({ current: 1, activeToday: true, secondsLeftToday: 100 }).label).toBe("1-day streak — today's done");
  });

  it("is out with no streak to keep", () => {
    expect(flame({ current: 0, activeToday: false, secondsLeftToday: DAY / 2 })).toEqual({
      state: "out",
      fuel: 0,
      label: "No streak yet — practise today to start one",
    });
  });
});

describe("timeLeft", () => {
  it.each([
    [6 * 3600, "6h 0m"],
    [3 * 3600 + 20 * 60 + 59, "3h 20m"],
    [3600, "1h 0m"],
    [3599, "59m"],
    [60, "1m"],
    [59, "under a minute"],
    [0, "under a minute"],
  ])("%i seconds reads %s", (s, text) => {
    expect(timeLeft(s)).toBe(text);
  });
});

describe("knownWords", () => {
  it.each([
    [0, "0", "0 known words"],
    [1, "1", "1 known word"],
    [999, "999", "999 known words"],
    [1234, "1,234", "1,234 known words"],
    [1234567, "1,234,567", "1,234,567 known words"],
  ])("%i reads %s", (n, text, label) => {
    expect(knownWords(n)).toEqual({ text, label });
  });
});
