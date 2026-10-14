import { describe, expect, it } from "vitest";
import { finishedSummary, markFinishedLabel, markFinishedMessage } from "./mark-finished";
import type { TextSummary } from "./types";

const text = (patch: Partial<TextSummary> = {}): TextSummary => ({
  id: 7,
  title: "Le chat",
  language: "fr",
  cefrLevel: "A2",
  wordCount: 9,
  uniqueWordCount: 7,
  isPublic: false,
  createdAt: "2026-10-01T00:00:00Z",
  owner: { id: 1, displayName: "Me", photoUrl: null },
  mine: true,
  hasAudio: false,
  kind: "text",
  category: "other",
  stats: { uniqueWords: 7, known: 2, learning: 1, ignored: 0, unseen: 4, knownPercent: 28.6 },
  ...patch,
} as TextSummary);

describe("markFinishedLabel", () => {
  it("says read for a text and watched for a video", () => {
    expect(markFinishedLabel("text")).toBe("Mark as read");
    expect(markFinishedLabel("video")).toBe("Mark as watched");
  });
});

describe("markFinishedMessage", () => {
  it("says how many new words will be marked known", () => {
    expect(markFinishedMessage(text())).toBe("4 new words will be marked known. Words you're learning keep their status.");
  });

  it("uses the singular for one word, and groups thousands", () => {
    expect(markFinishedMessage(text({ stats: { uniqueWords: 3, known: 2, learning: 0, ignored: 0, unseen: 1, knownPercent: 66 } })))
      .toBe("1 new word will be marked known. Words you're learning keep their status.");
    expect(markFinishedMessage(text({ stats: { uniqueWords: 1500, known: 0, learning: 0, ignored: 0, unseen: 1234, knownPercent: 0 } })))
      .toBe("1,234 new words will be marked known. Words you're learning keep their status.");
  });

  it("says no words change when it has no new words", () => {
    expect(markFinishedMessage(text({ stats: { uniqueWords: 7, known: 6, learning: 1, ignored: 0, unseen: 0, knownPercent: 85 } })))
      .toBe("It has no new words, so no words will change. It will count as finished.");
  });

  it("speaks without a number when the count isn't known", () => {
    expect(markFinishedMessage(text({ stats: undefined }))).toBe("Its new words will be marked known. Words you're learning keep their status.");
  });
});

describe("finishedSummary", () => {
  it("marks it finished and turns its new words known", () => {
    const done = finishedSummary(text({ progress: { position: 3, percent: 40, completed: false } }), 4);
    expect(done.progress).toEqual({ position: 3, percent: 100, completed: true });
    expect(done.stats).toEqual({ uniqueWords: 7, known: 6, learning: 1, ignored: 0, unseen: 0, knownPercent: 85.7 });
  });

  it("starts progress at the beginning when there was none", () => {
    expect(finishedSummary(text(), 4).progress).toEqual({ position: 0, percent: 100, completed: true });
  });

  it("leaves missing stats missing", () => {
    expect(finishedSummary(text({ stats: undefined }), 4).stats).toBeUndefined();
  });

  it("doesn't change the text it was given", () => {
    const t = text();
    finishedSummary(t, 4);
    expect(t.progress).toBeUndefined();
    expect(t.stats?.unseen).toBe(4);
  });
});
