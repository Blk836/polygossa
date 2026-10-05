import { describe, expect, it } from "vitest";
import { estimateTimings, formatVideoLength, KIND_FILTERS, toggleReaction, withKind, withLanguage, youtubeWatchUrl } from "./media";
import type { TextSummary, Token } from "./types";

describe("withKind", () => {
  it("leaves the path alone for all kinds", () => {
    expect(withKind("texts", "all")).toBe("texts");
    expect(withKind("library?sort=new", "all")).toBe("library?sort=new");
  });

  it("adds the kind as the first or a further query parameter", () => {
    expect(withKind("texts", "video")).toBe("texts?kind=video");
    expect(withKind("library/bookmarks", "text")).toBe("library/bookmarks?kind=text");
    expect(withKind("library?sort=new&page=0", "video")).toBe("library?sort=new&page=0&kind=video");
  });

  it("offers all, texts and videos in that order", () => {
    expect(KIND_FILTERS.map((k) => k.id)).toEqual(["all", "text", "video"]);
    expect(KIND_FILTERS.map((k) => k.label)).toEqual(["All", "Texts", "Videos"]);
  });
});

describe("withLanguage", () => {
  it("leaves the path alone when no language is chosen", () => {
    expect(withLanguage("texts", null)).toBe("texts");
    expect(withLanguage("texts", undefined)).toBe("texts");
    expect(withLanguage("texts", "")).toBe("texts");
  });

  it("adds the language as the first or a further query parameter", () => {
    expect(withLanguage("texts", "fr")).toBe("texts?language=fr");
    expect(withLanguage("texts?kind=video", "ja")).toBe("texts?kind=video&language=ja");
    expect(withLanguage(withKind("library/bookmarks", "text"), "es")).toBe("library/bookmarks?kind=text&language=es");
  });
});

describe("formatVideoLength", () => {
  it("formats minutes and seconds", () => {
    expect(formatVideoLength(213)).toBe("3:33");
    expect(formatVideoLength(5)).toBe("0:05");
    expect(formatVideoLength(60)).toBe("1:00");
  });

  it("adds hours with zero-padded minutes", () => {
    expect(formatVideoLength(3600)).toBe("1:00:00");
    expect(formatVideoLength(3725)).toBe("1:02:05");
  });

  it("returns null when unknown or not positive", () => {
    expect(formatVideoLength(undefined)).toBeNull();
    expect(formatVideoLength(null)).toBeNull();
    expect(formatVideoLength(0)).toBeNull();
    expect(formatVideoLength(-4)).toBeNull();
  });

  it("rounds fractional seconds down", () => {
    expect(formatVideoLength(59.9)).toBe("0:59");
  });
});

describe("youtubeWatchUrl", () => {
  it("links to the video on YouTube", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

const tok = (index: number, text: string, word: boolean, sentence = 0): Token => ({ index, text, word, sentence });

describe("estimateTimings", () => {
  // Same weights as the backend's AudioAligner.estimate: word = length + 1, sentence end = 4, other gaps = 0.3.
  const tokens = [tok(0, "ab", true), tok(1, " ", false), tok(2, "c", true), tok(3, ".", false)];
  // weights: 3, 0.3, 2, 4 → total 9.3

  it("spreads words over the duration by length, with pauses at sentence ends", () => {
    const t = estimateTimings(tokens, 9300);
    expect(t).toEqual([
      { i: 0, s: 0, e: 3000 },
      { i: 2, s: 3300, e: 5300 },
    ]);
  });

  it("counts characters, not UTF-16 units", () => {
    const t = estimateTimings([tok(0, "𝒳", true), tok(1, "y", true)], 4000);
    expect(t).toEqual([
      { i: 0, s: 0, e: 2000 },
      { i: 1, s: 2000, e: 4000 },
    ]);
  });

  it("treats newlines and CJK full stops as sentence pauses", () => {
    const t = estimateTimings([tok(0, "a", true), tok(1, "\n", false), tok(2, "b", true), tok(3, "。", false)], 1200);
    expect(t).toEqual([
      { i: 0, s: 0, e: 200 },
      { i: 2, s: 600, e: 800 },
    ]);
  });

  it("returns nothing without words or duration", () => {
    expect(estimateTimings([], 1000)).toEqual([]);
    expect(estimateTimings(tokens, 0)).toEqual([]);
    expect(estimateTimings(tokens, Number.NaN)).toEqual([]);
  });
});

describe("toggleReaction", () => {
  const item = { id: 1, likes: 3, liked: false, bookmarked: false } as TextSummary;

  it("likes and unlikes, keeping the count in step", () => {
    const liked = toggleReaction(item, "like");
    expect(liked).toMatchObject({ liked: true, likes: 4, bookmarked: false });
    expect(toggleReaction(liked, "like")).toMatchObject({ liked: false, likes: 3 });
  });

  it("treats a missing like count as zero", () => {
    expect(toggleReaction({ id: 2 } as TextSummary, "like")).toMatchObject({ liked: true, likes: 1 });
  });

  it("bookmarks and unbookmarks without touching likes", () => {
    const saved = toggleReaction(item, "bookmark");
    expect(saved).toMatchObject({ bookmarked: true, likes: 3, liked: false });
    expect(toggleReaction(saved, "bookmark")).toMatchObject({ bookmarked: false });
  });

  it("returns a new object", () => {
    expect(toggleReaction(item, "like")).not.toBe(item);
    expect(item.liked).toBe(false);
  });
});
