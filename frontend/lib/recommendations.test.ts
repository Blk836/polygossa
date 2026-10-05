import { describe, expect, it } from "vitest";
import {
  impressionBatches,
  INTEREST_MINIMUM,
  openEvent,
  reasonLabel,
  recommendationsPath,
  shelfHeading,
  withoutItem,
  type RecommendedShelf,
} from "./recommendations";
import type { TextSummary } from "./types";

const text = (id: number) => ({ id, title: `T${id}` }) as TextSummary;
const item = (id: number) => ({ text: text(id), reason: { kind: "new" as const } });

describe("recommendationsPath", () => {
  it("asks for the language in the top bar, or every language", () => {
    expect(recommendationsPath("fr")).toBe("recommendations?language=fr");
    expect(recommendationsPath("")).toBe("recommendations");
  });
});

describe("shelfHeading", () => {
  it("names each shelf", () => {
    expect(shelfHeading({ id: "continue", items: [] }).title).toBe("Continue reading");
    expect(shelfHeading({ id: "for-you", items: [] }).title).toBe("For you");
    expect(shelfHeading({ id: "just-right", items: [] }).title).toBe("Just right for you");
    expect(shelfHeading({ id: "stretch", items: [] }).title).toBe("Stretch");
  });

  it("says what Because you read refers to, and whether it was liked or read", () => {
    expect(shelfHeading({ id: "because", anchor: { id: 1, title: "Tapas en Madrid", liked: true }, items: [] }).title)
      .toBe("Because you liked Tapas en Madrid");
    expect(shelfHeading({ id: "because", anchor: { id: 1, title: "Le chat", liked: false }, items: [] }).title)
      .toBe("Because you read Le chat");
    expect(shelfHeading({ id: "because", items: [] }).title).toBe("Because you read this");
  });

  it("names the topic, or the category's label", () => {
    expect(shelfHeading({ id: "topic", topic: "cooking", items: [] }).title).toBe("More about cooking");
    expect(shelfHeading({ id: "topic", category: "food", items: [] }).title).toBe("More about Food & cooking");
  });

  it("gives every shelf a one-line explanation", () => {
    for (const id of ["continue", "for-you", "because", "topic", "just-right", "stretch"] as const) {
      expect(shelfHeading({ id, items: [] }).subtitle.length).toBeGreaterThan(10);
    }
  });
});

describe("reasonLabel", () => {
  it("says why each card is there", () => {
    expect(reasonLabel({ kind: "progress", percent: 42 })).toBe("42% read");
    expect(reasonLabel({ kind: "known", percent: 96 })).toBe("96% known words");
    expect(reasonLabel({ kind: "known", percent: 95.5 })).toBe("95.5% known words");
    expect(reasonLabel({ kind: "because", title: "Tapas en Madrid", liked: true })).toBe("Because you liked Tapas en Madrid");
    expect(reasonLabel({ kind: "because", title: "Le chat", liked: false })).toBe("Because you read Le chat");
    expect(reasonLabel({ kind: "topic", topic: "cooking" })).toBe("You like cooking");
    expect(reasonLabel({ kind: "category", category: "travel" })).toBe("You like Travel");
    expect(reasonLabel({ kind: "level", level: "B1" })).toBe("At your level (B1)");
    expect(reasonLabel({ kind: "popular", likes: 1 })).toBe("1 like this month");
    expect(reasonLabel({ kind: "popular", likes: 12 })).toBe("12 likes this month");
    expect(reasonLabel({ kind: "new" })).toBe("New");
    expect(reasonLabel({ kind: "similar" })).toBe("Like what you enjoy");
    expect(reasonLabel({ kind: "explore" })).toBe("Something different");
  });

  it("copes with missing details and unknown kinds", () => {
    expect(reasonLabel({ kind: "progress" })).toBe("0% read");
    expect(reasonLabel({ kind: "known" })).toBe("0% known words");
    expect(reasonLabel({ kind: "level" })).toBe("At your level");
    expect(reasonLabel({ kind: "popular" })).toBe("0 likes this month");
    expect(reasonLabel({ kind: "because" })).toBe("Because you read something similar");
    expect(reasonLabel({ kind: "topic" })).toBe("You like this subject");
    expect(reasonLabel({ kind: "mystery" as never })).toBe("");
  });
});

describe("impressionBatches", () => {
  it("logs every shown card once, per shelf, with its position", () => {
    const shelves: RecommendedShelf[] = [
      { id: "for-you", items: [item(5), item(7)] },
      { id: "stretch", items: [item(7)] },
      { id: "just-right", items: [] },
    ];
    expect(impressionBatches(shelves)).toEqual([
      { type: "impression", shelf: "for-you", items: [{ textId: 5, position: 0 }, { textId: 7, position: 1 }] },
      { type: "impression", shelf: "stretch", items: [{ textId: 7, position: 0 }] },
    ]);
  });

  it("logs nothing for no shelves", () => {
    expect(impressionBatches([])).toEqual([]);
  });
});

describe("openEvent", () => {
  it("is an open of one card at its position", () => {
    expect(openEvent("because", 9, 3)).toEqual({ type: "open", shelf: "because", items: [{ textId: 9, position: 3 }] });
  });
});

describe("withoutItem", () => {
  it("removes the item from every shelf and drops shelves left empty", () => {
    const shelves: RecommendedShelf[] = [
      { id: "for-you", items: [item(1), item(2)] },
      { id: "stretch", items: [item(2)] },
    ];
    expect(withoutItem(shelves, 2)).toEqual([{ id: "for-you", items: [item(1)] }]);
    expect(withoutItem(shelves, 3)).toEqual(shelves);
  });
});

describe("INTEREST_MINIMUM", () => {
  it("asks for at least three interests", () => {
    expect(INTEREST_MINIMUM).toBe(3);
  });
});
