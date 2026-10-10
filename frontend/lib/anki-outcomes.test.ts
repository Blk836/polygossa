import { describe, expect, it } from "vitest";
import { outcomeLines } from "./anki-outcomes";
import type { AnkiRun } from "./anki-types";

const run: AnkiRun = {
  id: 1, dryRun: true, state: "done", startedAt: "", cards: 20, becameKnown: 3, addedKnown: 1, addedLearning: 0,
  overLimit: 2, skippedEmpty: 1, skippedTooLong: 0, skippedMedia: 0, leaveReview: 4,
};

describe("a sync's counts in words", () => {
  it("say what a preview will do, leaving out what doesn't happen", () => {
    expect(outcomeLines(run, true).map((l) => l.label)).toEqual([
      "3 of your words will become known",
      "1 word will be added as known",
      "2 words won't be added because of the Free plan's saved-word limit",
      "1 card will be skipped: the word field is empty",
      "4 words will leave the Review tab here, since you review them in Anki",
    ]);
  });

  it("say what a sync did", () => {
    expect(outcomeLines(run, false).map((l) => l.label)).toEqual([
      "3 of your words became known",
      "1 word was added as known",
      "2 words weren't added because of the Free plan's saved-word limit",
      "1 card was skipped: the word field is empty",
      "4 words left the Review tab here, since you review them in Anki",
    ]);
  });

  it("read naturally for one word or card", () => {
    const one = { ...run, becameKnown: 1, addedKnown: 0, overLimit: 1, skippedEmpty: 0, leaveReview: 1 };
    expect(outcomeLines(one, true).map((l) => l.label)).toEqual([
      "1 of your words will become known",
      "1 word won't be added because of the Free plan's saved-word limit",
      "1 word will leave the Review tab here, since you review it in Anki",
    ]);
  });

  it("name the outcome each count opens", () => {
    expect(outcomeLines(run, false).map((l) => [l.outcome, l.count])).toEqual([
      ["became_known", 3], ["added_known", 1], ["over_limit", 2], ["skipped_empty", 1], ["leave_review", 4],
    ]);
  });
});
