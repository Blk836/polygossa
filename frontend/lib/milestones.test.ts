import { describe, expect, it } from "vitest";
import { MILESTONES, reachedMilestone, streakNews } from "./milestones";

describe("reachedMilestone", () => {
  it.each([
    [99, 100, 100],
    [498, 503, 500],
    [999, 1000, 1000],
    [4990, 5010, 5000],
  ])("going from %i to %i reaches %i", (before, after, milestone) => {
    expect(reachedMilestone(before, after, [])).toEqual({ show: milestone, seen: MILESTONES.filter((m) => m <= after) });
  });

  it("shows nothing while the count stays between milestones", () => {
    expect(reachedMilestone(101, 120, [100]).show).toBeNull();
  });

  it("shows nothing when the count goes down", () => {
    expect(reachedMilestone(1001, 999, []).show).toBeNull();
  });

  it("shows a milestone only once", () => {
    expect(reachedMilestone(999, 1000, [100, 500, 1000]).show).toBeNull();
  });

  it("shows only the higher of two milestones passed at once, and counts both as seen", () => {
    expect(reachedMilestone(480, 1020, [100])).toEqual({ show: 1000, seen: [100, 500, 1000] });
  });

  it("starting at a milestone is not reaching it", () => {
    expect(reachedMilestone(100, 100, []).show).toBeNull();
  });
});

describe("streakNews", () => {
  it("says a streak of two days or more was kept, and what tomorrow makes it", () => {
    expect(streakNews(7)).toEqual({ title: "7-day streak kept", body: "Come back tomorrow to make it 8." });
  });

  it("says a one-day streak has started", () => {
    expect(streakNews(1)).toEqual({ title: "Streak started", body: "Come back tomorrow to make it 2." });
  });
});
