import { describe, expect, it } from "vitest";
import type { Token } from "@/lib/types";
import { fitPages, splitPages, wordBreaks, type FitOptions, type WordBox } from "./reader-fit";

const H = 38; // line height
const L = 10; // words per line

/** `n` words laid out `L` to a line, from `offset` px; word k has token index 2k (separators in between). */
function boxes(n: number, marks: { paragraphEnd?: number[]; sentenceEnd?: number[] } = {}, offset = 0): WordBox[] {
  return Array.from({ length: n }, (_, k) => ({
    index: 2 * k,
    top: offset + Math.floor(k / L) * H,
    bottom: offset + Math.floor(k / L) * H + H,
    paragraphEnd: k === n - 1 || (marks.paragraphEnd ?? []).includes(k),
    sentenceEnd: (marks.sentenceEnd ?? []).includes(k),
  }));
}

const opts = (o: Partial<FitOptions> = {}): FitOptions => ({ height: 100 * H, maxWords: 250, singlePageMaxWords: 300, lastExtra: 0, ...o });
/** Page starts as word positions (k), for readability. */
const fit = (b: WordBox[], o: Partial<FitOptions> = {}) => fitPages(b, opts(o)).map((i) => i / 2);

describe("fitPages", () => {
  it("returns no pages for no words", () => {
    expect(fitPages([], opts())).toEqual([]);
  });

  it("keeps a text that fits the screen on one page", () => {
    expect(fit(boxes(300), { height: 30 * H })).toEqual([0]);
    expect(fit(boxes(300, {}, 500), { height: 30 * H })).toEqual([0]); // measured from the first line, wherever it is
    expect(fit(boxes(300, {}, 500), { height: 30 * H - 1 })).toEqual([0, 250]);
  });

  it("caps pages at the word maximum even when more would fit", () => {
    expect(fit(boxes(301), { height: 100 * H })).toEqual([0, 250]);
    expect(fit(boxes(100), { maxWords: 40, singlePageMaxWords: 30 })).toEqual([0, 40, 80]);
  });

  it("fills each page to the screen height, measured from the line its first word is on", () => {
    expect(fit(boxes(120), { height: 5 * H })).toEqual([0, 50, 100]);
    expect(fit(boxes(120), { height: 5 * H + H / 2 })).toEqual([0, 50, 100]); // half a line doesn't fit a line
  });

  it("ends a page at a paragraph end in its last quarter", () => {
    expect(fit(boxes(120, { paragraphEnd: [44] }), { height: 5 * H })).toEqual([0, 45, 90]);
  });

  it("counts the last quarter exactly, on every page", () => {
    // A 50-word page's last quarter starts at its 38th word (k = 37); the second page starts at k = 50.
    expect(fit(boxes(120, { paragraphEnd: [37] }), { height: 5 * H })).toEqual([0, 38, 80]);
    expect(fit(boxes(120, { paragraphEnd: [36] }), { height: 5 * H })).toEqual([0, 50, 100]);
    expect(fit(boxes(150, { sentenceEnd: [87] }), { height: 5 * H })).toEqual([0, 50, 88, 130]);
  });

  it("ignores paragraph and sentence ends earlier than that", () => {
    expect(fit(boxes(120, { paragraphEnd: [30], sentenceEnd: [35] }), { height: 5 * H })).toEqual([0, 50, 100]);
  });

  it("falls back to a sentence end, and prefers a paragraph end to a later sentence end", () => {
    expect(fit(boxes(120, { sentenceEnd: [41, 46] }), { height: 5 * H })).toEqual([0, 47, 90]);
    expect(fit(boxes(120, { paragraphEnd: [40], sentenceEnd: [46] }), { height: 5 * H })).toEqual([0, 41, 90]);
  });

  it("takes the latest sentence end, so a page whose last word ends a sentence stays full", () => {
    expect(fit(boxes(120, { sentenceEnd: [40, 49] }), { height: 5 * H })).toEqual([0, 50, 100]);
  });

  it("leaves room under the last page for what follows it (the finish panel)", () => {
    expect(fit(boxes(30), { height: 4 * H, lastExtra: 2 * H })).toEqual([0, 20]);
    expect(fit(boxes(20), { height: 4 * H, lastExtra: 2 * H })).toEqual([0]);
  });

  it("leaves that room under the last page only", () => {
    expect(fit(boxes(120), { height: 5 * H, lastExtra: 2 * H })).toEqual([0, 50, 100]);
  });

  it("always moves on: a word taller than the page gets a page of its own", () => {
    expect(fit(boxes(3), { height: 0 })).toEqual([0, 1, 2]);
    expect(fit(boxes(2), { height: H, lastExtra: 5 * H })).toEqual([0, 1]);
  });
});

/** Tokens: words and separators alternating, as the backend makes them. */
function tokens(...parts: string[]): Token[] {
  return parts.map((text, index) => {
    const word = /\p{L}/u.test(text);
    return { index, text, word, sentence: 0, ...(word ? { normalized: text } : {}) };
  });
}

const show = (pages: Token[][][]) => pages.map((pg) => pg.map((p) => p.map((t) => t.text).join("")));

describe("splitPages", () => {
  const t = tokens("«", "a", " ", "b", ". ", "c", " ", "d", ". ", "e");
  const paragraphs = [t.slice(0, 5), t.slice(5)];

  it("splits at each page's first word, keeping separators with the page before", () => {
    expect(show(splitPages(paragraphs, [1, 5, 9]))).toEqual([["«a b. "], ["c d. "], ["e"]]);
    expect(show(splitPages(paragraphs, [1, 3]))).toEqual([["«a "], ["b. ", "c d. e"]]);
  });

  it("puts anything before the first word on the first page", () => {
    expect(splitPages(paragraphs, [1])[0][0][0].text).toBe("«");
  });

  it("keeps the tokens themselves, adding none", () => {
    const pages = splitPages(paragraphs, [1, 3]);
    expect(pages[1][0]).toEqual([t[3], t[4]]);
    expect(pages.flat(2)).toEqual(t);
  });

  it("returns one page of every paragraph for a single start, and none for none", () => {
    expect(splitPages(paragraphs, [1])).toEqual([paragraphs]);
    expect(splitPages(paragraphs, [])).toEqual([]);
  });
});

describe("wordBreaks", () => {
  it("marks the last word of each paragraph and words followed by sentence-final punctuation", () => {
    const t = tokens("a", " ", "b", "? ", "c", ", ", "d", "。", "e", " ", "f", ".", "g");
    const breaks = wordBreaks([t.slice(0, 10), t.slice(10)]);
    expect(breaks.map((b) => b.index)).toEqual([0, 2, 4, 6, 8, 10, 12]);
    expect(breaks.map((b) => b.sentenceEnd)).toEqual([false, true, false, true, false, true, false]);
    expect(breaks.map((b) => b.paragraphEnd)).toEqual([false, false, false, false, true, false, true]);
  });

  it("skips a paragraph that has no words", () => {
    const t = tokens("a", "* * *", "b");
    expect(wordBreaks([[t[0]], [t[1]], [t[2]]]).map((b) => [b.index, b.paragraphEnd])).toEqual([[0, true], [2, true]]);
  });
});
