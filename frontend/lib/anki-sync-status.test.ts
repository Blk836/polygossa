import { describe, expect, it } from "vitest";
import { ankiBadgeText, changeSummary, nextSyncText, syncedAgoText } from "./anki-sync-status";
import type { AnkiRun } from "./anki-types";

const MIN = 60_000;

const run = (counts: Partial<AnkiRun>): AnkiRun => ({
  id: 1, dryRun: false, state: "done", startedAt: "", cards: 20, becameKnown: 0, addedKnown: 0, addedLearning: 0,
  overLimit: 0, skippedEmpty: 0, skippedTooLong: 0, skippedMedia: 0, leaveReview: 0, skippedNoteType: 0, waitingNoteType: 0,
  ...counts,
});

describe("how long ago Anki synced", () => {
  it("says just now under a minute", () => {
    expect(syncedAgoText(0)).toBe("just now");
    expect(syncedAgoText(59_000)).toBe("just now");
  });

  it("counts whole minutes, then hours, then days", () => {
    expect(syncedAgoText(4 * MIN + 30_000)).toBe("4 min ago");
    expect(syncedAgoText(59 * MIN)).toBe("59 min ago");
    expect(syncedAgoText(2 * 60 * MIN + 5 * MIN)).toBe("2 h ago");
    expect(syncedAgoText(26 * 60 * MIN)).toBe("1 day ago");
    expect(syncedAgoText(3 * 24 * 60 * MIN)).toBe("3 days ago");
  });
});

describe("when Anki syncs next", () => {
  it("rounds up to whole minutes, never below one", () => {
    expect(nextSyncText(15 * MIN)).toBe("next sync in 15 min");
    expect(nextSyncText(10 * MIN + 1)).toBe("next sync in 11 min");
    expect(nextSyncText(1)).toBe("next sync in 1 min");
    expect(nextSyncText(-5_000)).toBe("next sync in 1 min");
  });
});

describe("what the last sync changed", () => {
  it("names words made known and words added", () => {
    expect(changeSummary(run({ becameKnown: 3, addedKnown: 2, addedLearning: 10 }))).toBe("3 words now known, 12 added");
    expect(changeSummary(run({ becameKnown: 1, addedLearning: 1 }))).toBe("1 word now known, 1 added");
  });

  it("leaves out the half that didn't happen", () => {
    expect(changeSummary(run({ becameKnown: 1 }))).toBe("1 word now known");
    expect(changeSummary(run({ addedKnown: 1 }))).toBe("1 word added");
    expect(changeSummary(run({ addedLearning: 5 }))).toBe("5 words added");
  });

  it("is empty when no word changed", () => {
    expect(changeSummary(run({ skippedEmpty: 4, leaveReview: 2 }))).toBeNull();
  });
});

describe("the Anki badge on a word", () => {
  it("says what state its card is in", () => {
    expect(ankiBadgeText({ state: "mature", promoted: false }, "learning")).toBe("In Anki: mature card (next review 21+ days)");
    expect(ankiBadgeText({ state: "young", promoted: false }, "learning")).toBe("In Anki: being learned");
    expect(ankiBadgeText({ state: "new", promoted: false }, "learning")).toBe("In Anki: not reviewed yet");
  });

  it("adds that Anki made the word known", () => {
    expect(ankiBadgeText({ state: "mature", promoted: true }, "known")).toBe("In Anki: mature card (next review 21+ days). Known through Anki");
  });

  it("doesn't claim Anki made it known once I changed it myself", () => {
    expect(ankiBadgeText({ state: "mature", promoted: true }, "learning")).toBe("In Anki: mature card (next review 21+ days)");
  });
});
