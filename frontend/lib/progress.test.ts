import { describe, expect, it } from "vitest";
import { calendarWeeks, goalProgress, intensity, milestone, periodChange, periodLabel, STATS_PERIODS, streakMessage, weekChange, weekStrip } from "./progress";
import type { ActivityDay } from "./types";

const day = (date: string, over: Partial<ActivityDay> = {}): ActivityDay => ({
  day: date, readingSeconds: 0, wordsSaved: 0, wordsKnown: 0, reviews: 0, writingTests: 0, wordsRead: 0, listenedSeconds: 0,
  active: false, goalMet: false, ...over,
});

describe("milestone", () => {
  it("measures progress from the last milestone passed to the next", () => {
    expect(milestone(0)).toEqual({ from: 0, to: 100, remaining: 100, fraction: 0 });
    expect(milestone(99)).toEqual({ from: 0, to: 100, remaining: 1, fraction: 0.99 });
    expect(milestone(100)).toEqual({ from: 100, to: 250, remaining: 150, fraction: 0 });
    expect(milestone(1240)).toEqual({ from: 1000, to: 1500, remaining: 260, fraction: 0.48 });
  });

  it("keeps going past the table in steps of 10,000", () => {
    expect(milestone(50_000)).toEqual({ from: 50_000, to: 60_000, remaining: 10_000, fraction: 0 });
    expect(milestone(63_000)).toEqual({ from: 60_000, to: 70_000, remaining: 7_000, fraction: 0.3 });
  });
});

describe("streakMessage", () => {
  it("congratulates once today is done", () => {
    expect(streakMessage({ current: 1, best: 1, activeToday: true })).toBe("Day 1 done — come back tomorrow to make it 2.");
    expect(streakMessage({ current: 12, best: 30, activeToday: true })).toBe("Day 12 done — come back tomorrow to make it 13.");
  });

  it("calls out a new personal best", () => {
    expect(streakMessage({ current: 8, best: 8, activeToday: true })).toBe("Day 8 done — a new personal best!");
  });

  it("warns that a live streak ends tonight without practice", () => {
    expect(streakMessage({ current: 5, best: 9, activeToday: false }))
      .toBe("Read, review or save a word today to keep your 5-day streak.");
  });

  it("invites a fresh start, mentioning the best streak to beat", () => {
    expect(streakMessage({ current: 0, best: 0, activeToday: false })).toBe("Read for a minute or save a word to start a streak.");
    expect(streakMessage({ current: 0, best: 6, activeToday: false })).toBe("Start a new streak today — your best is 6 days.");
  });
});

describe("weekChange", () => {
  it("shows growth as a percentage", () => {
    expect(weekChange(135, 100)).toEqual({ trend: "up", text: "+35% on last week" });
    expect(weekChange(1, 3)).toEqual({ trend: "steady", text: "3 last week" });
  });

  it("never shows a negative number, and handles empty weeks", () => {
    expect(weekChange(5, 0)).toEqual({ trend: "up", text: "Up from nothing last week" });
    expect(weekChange(0, 0)).toEqual({ trend: "steady", text: "Nothing yet — this week starts today" });
    expect(weekChange(4, 4)).toEqual({ trend: "steady", text: "Same as last week" });
  });

  it("formats the last-week figure with the given formatter", () => {
    expect(weekChange(10, 90, (n) => `${n} min`)).toEqual({ trend: "steady", text: "90 min last week" });
  });
});

describe("intensity", () => {
  it("is 0 for a day without practice", () => {
    expect(intensity(day("2026-03-20", { readingSeconds: 59 }))).toBe(0);
  });

  it("grows with minutes read and words learned", () => {
    expect(intensity(day("2026-03-20", { active: true, wordsSaved: 1 }))).toBe(1);
    expect(intensity(day("2026-03-20", { active: true, readingSeconds: 15 * 60 }))).toBe(2);
    expect(intensity(day("2026-03-20", { active: true, wordsSaved: 6, wordsKnown: 4 }))).toBe(2);
    expect(intensity(day("2026-03-20", { active: true, readingSeconds: 30 * 60 }))).toBe(3);
    expect(intensity(day("2026-03-20", { active: true, wordsKnown: 25 }))).toBe(3);
  });
});

describe("weekStrip", () => {
  it("labels the last seven days with weekday initials, today last", () => {
    const days = ["2026-03-13", "2026-03-14", "2026-03-15", "2026-03-16", "2026-03-17", "2026-03-18", "2026-03-19", "2026-03-20"]
      .map((d, i) => day(d, { active: i % 2 === 0 }));
    const strip = weekStrip(days);
    expect(strip.map((s) => s.label)).toEqual(["S", "S", "M", "T", "W", "T", "F"]);
    expect(strip.map((s) => s.active)).toEqual([false, true, false, true, false, true, false]);
    expect(strip.at(-1)?.today).toBe(true);
    expect(strip.filter((s) => s.today)).toHaveLength(1);
  });
});

describe("calendarWeeks", () => {
  const run = (from: string, count: number) =>
    Array.from({ length: count }, (_, i) => day(new Date(Date.parse(from) + i * 86_400_000).toISOString().slice(0, 10)));

  it("puts consecutive days in Monday-first weeks, padding before the first day", () => {
    // 2026-03-18 is a Wednesday.
    const weeks = calendarWeeks(run("2026-03-18", 6));
    expect(weeks.map((w) => w.map((d) => d?.day.slice(8) ?? null))).toEqual([
      [null, null, "18", "19", "20", "21", "22"],
      ["23"],
    ]);
  });

  it("needs no padding when the first day is a Monday", () => {
    expect(calendarWeeks(run("2026-03-16", 14)).map((w) => w.length)).toEqual([7, 7]);
    expect(calendarWeeks([])).toEqual([]);
  });
});

describe("STATS_PERIODS", () => {
  it("offers last week, month, quarter, year and all time, starting with last week", () => {
    expect(STATS_PERIODS.map((p) => [p.key, p.label])).toEqual([
      ["week", "Last week"],
      ["month", "Last month"],
      ["quarter", "Last quarter"],
      ["year", "Last year"],
      ["all", "All time"],
    ]);
  });
});

describe("periodChange", () => {
  it("words a week exactly like weekChange", () => {
    for (const [a, b] of [[135, 100], [1, 3], [5, 0], [0, 0], [4, 4]]) {
      expect(periodChange(a, b, "week")).toEqual(weekChange(a, b));
    }
  });

  it.each([
    ["month", 150, 100, "up", "+50% on the month before"],
    ["quarter", 3, 0, "up", "Up from nothing the quarter before"],
    ["year", 4, 4, "steady", "Same as the year before"],
    ["month", 0, 0, "steady", "Nothing yet — start today"],
    ["quarter", 1, 9, "steady", "9 the quarter before"],
  ] as const)("a %s of %i against %i", (period, now, before, trend, text) => {
    expect(periodChange(now, before, period)).toEqual({ trend, text });
  });

  it("formats the earlier figure", () => {
    expect(periodChange(10, 90, "month", (n) => `${n} min`)).toEqual({ trend: "steady", text: "90 min the month before" });
  });

  it("all time has nothing to compare against", () => {
    expect(periodChange(12, null, "all")).toEqual({ trend: "steady", text: "Since you joined" });
    expect(periodChange(12, 3, "all")).toEqual({ trend: "steady", text: "Since you joined" });
  });

  it("a period with no earlier figure says so rather than comparing", () => {
    expect(periodChange(5, null, "month")).toEqual({ trend: "steady", text: "Since you joined" });
  });
});

describe("periodLabel", () => {
  it.each([
    ["week", "Last week"],
    ["quarter", "Last quarter"],
    ["all", "All time"],
  ] as const)("%s reads %s", (key, label) => {
    expect(periodLabel(key)).toBe(label);
  });
});

describe("goalProgress", () => {
  it("says how far today has got, with the unit of the goal", () => {
    expect(goalProgress({ kind: "words_read", target: 1000, done: 340, met: false })).toEqual({ text: "340 / 1,000 words read", percent: 34, met: false });
    expect(goalProgress({ kind: "reviews", target: 20, done: 1, met: false }).text).toBe("1 / 20 reviews");
    expect(goalProgress({ kind: "minutes_read", target: 15, done: 15, met: true })).toEqual({ text: "15 / 15 minutes read", percent: 100, met: true });
    expect(goalProgress({ kind: "minutes_listened", target: 30, done: 7, met: false }).text).toBe("7 / 30 minutes listened");
  });

  it("caps the bar at 100%", () => {
    expect(goalProgress({ kind: "words_read", target: 100, done: 250, met: true }).percent).toBe(100);
  });
});
