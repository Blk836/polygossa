import { beforeEach, describe, expect, it } from "vitest";
import type { Token } from "@/lib/types";
import {
  MAX_PAGE_WORDS,
  MIN_LAST_PAGE_WORDS,
  PAGE_WORDS,
  SINGLE_PAGE_MAX_WORDS,
  pageOfToken,
  pageRange,
  pageTokens,
  parsePage,
  resolvePage,
  toPages,
  unseenOnPage,
  wordCount,
  type ReaderPage,
} from "./reader-pages";
import { toParagraphs } from "./reader-text";

function build(parts: string[]): Token[] {
  let sentence = 0;
  return parts.map((text, index) => {
    const word = /\p{L}/u.test(text);
    const t: Token = { index, text, word, sentence, ...(word ? { normalized: text.toLowerCase() } : {}) };
    if (!word && text.includes(".")) sentence++;
    return t;
  });
}

function text(paragraphs: number, sentences: number, words: number): Token[] {
  const parts: string[] = [];
  for (let p = 0; p < paragraphs; p++) {
    for (let s = 0; s < sentences; s++) {
      for (let w = 0; w < words; w++) {
        parts.push(`w${p}x${s}x${w}`);
        const last = w === words - 1;
        if (!last) parts.push(" ");
        else if (s < sentences - 1) parts.push(". ");
        else if (p < paragraphs - 1) parts.push(".\n\n");
        else parts.push(".");
      }
    }
  }
  return build(parts);
}

function paras(...sizes: number[]): Token[] {
  const parts: string[] = [];
  sizes.forEach((n, p) => {
    for (let w = 0; w < n; w++) parts.push(`p${p}w${w}`, w < n - 1 ? " " : p < sizes.length - 1 ? ".\n\n" : ".");
  });
  return build(parts);
}

const pageWords = (page: Token[][]) => wordCount(page.flat());
const wordIndexes = (tokens: Token[]) => tokens.filter((t) => t.word).map((t) => t.index);

describe("wordCount", () => {
  it("counts only word tokens", () => {
    expect(wordCount(build(["Uno", " ", "dos", ". "]))).toBe(2);
    expect(wordCount([])).toBe(0);
  });
});

describe("toPages", () => {
  it("returns no pages for an empty text", () => {
    expect(toPages([])).toEqual([]);
  });

  it("keeps a text of up to the single-page limit on one page", () => {
    const tokens = text(10, 1, SINGLE_PAGE_MAX_WORDS / 10);
    const pages = toPages(tokens);
    expect(pages).toHaveLength(1);
    expect(pages[0]).toEqual(toParagraphs(tokens));
  });

  it("splits a text just over the single-page limit", () => {
    expect(toPages(text(1, 31, 10)).length).toBeGreaterThan(1);
  });

  it("splits long texts at paragraph boundaries into pages of about the target size", () => {
    const tokens = text(10, 4, 25);
    const pages = toPages(tokens);
    expect(pages.map(pageWords)).toEqual([200, 200, 200, 200, 200]);
    for (const page of pages) for (const p of page) expect(wordCount(p)).toBe(100);
  });

  it("adds a paragraph when that brings the page closer to the target", () => {
    const pages = toPages(text(12, 1, 60));
    expect(pages.map(pageWords)).toEqual([240, 240, 240]);
  });

  it("adds a paragraph that lands nearer the target even when it goes over", () => {
    expect(toPages(text(4, 1, 150)).map(pageWords)).toEqual([300, 300]);
  });

  it("starts a new page rather than go over the maximum", () => {
    expect(toPages(text(3, 1, 200)).map(pageWords)).toEqual([200, 200, 200]);
  });

  it("splits a transcript with no paragraph breaks at sentence ends", () => {
    const tokens = text(1, 100, 10);
    const pages = toPages(tokens);
    expect(pages.map(pageWords)).toEqual([250, 250, 250, 250]);
    for (const page of pages.slice(0, -1)) {
      const last = page.at(-1)!.at(-1)!;
      expect(last.word).toBe(false);
      expect(last.text).toContain(".");
    }
  });

  it("prefers a sentence end to an exact page size", () => {
    expect(toPages(text(1, 20, 30)).map(pageWords)).toEqual([240, 240, 120]);
  });

  it("starts a new page when a long paragraph would push it past the maximum, even if nearer the target", () => {
    const big = (n: number, tag: string) => Array.from({ length: n }, (_, k) => [`${tag}${k}`, k < n - 1 ? " " : ". "]).flat();
    const tokens = build([...big(20, "a").slice(0, -1), ".\n\n", ...big(83, "b"), ...big(250, "c").slice(0, -1), "."]);
    expect(toPages(tokens).map(pageWords)).toEqual([20, 333]);
  });

  it("splits a sentence longer than a page between words", () => {
    const tokens = text(1, 1, 700);
    const pages = toPages(tokens);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) expect(pageWords(page)).toBeLessThanOrEqual(MAX_PAGE_WORDS);
    expect(pages.map(pageWords)).toEqual([250, 250, 200]);
    const words = pages.flat(2).filter((t) => t.word);
    expect(words.map((t) => t.text)).toEqual(tokens.filter((t) => t.word).map((t) => t.text));
  });

  it("never puts more than the maximum on a page", () => {
    for (const tokens of [text(3, 1, 240), text(5, 1, 249), text(1, 7, 90), text(40, 3, 7), text(2, 1, 1000)]) {
      for (const page of toPages(tokens)) expect(pageWords(page)).toBeLessThanOrEqual(MAX_PAGE_WORDS);
    }
  });

  it("loses nothing: every word appears once, in order, and paragraphs are unchanged", () => {
    for (const tokens of [text(10, 4, 25), text(1, 100, 10), text(1, 1, 700), text(7, 3, 33), text(3, 1, 240)]) {
      const pages = toPages(tokens);
      expect(wordIndexes(pages.flat(2))).toEqual(wordIndexes(tokens));
      expect(pages.flat(2).map((t) => t.text).join("").replace(/\s+/g, "")).toBe(
        toParagraphs(tokens).flat().map((t) => t.text).join("").replace(/\s+/g, ""),
      );
      for (const page of pages) {
        expect(page.length).toBeGreaterThan(0);
        for (const p of page) expect(p.length).toBeGreaterThan(0);
      }
    }
  });

  it("merges a tiny last page into the previous one", () => {
    expect(toPages(text(1, 52, 10)).map(pageWords)).toEqual([250, 270]);
    expect(toPages(paras(150, 150, MIN_LAST_PAGE_WORDS - 1)).map(pageWords)).toEqual([300 + MIN_LAST_PAGE_WORDS - 1]);
  });

  it("keeps a last page of at least the minimum size", () => {
    expect(toPages(text(1, 35, 10)).map(pageWords)).toEqual([250, 100]);
    expect(toPages(text(1, 55, 10)).map(pageWords)).toEqual([250, 250, MIN_LAST_PAGE_WORDS]);
  });

  it("merges a tiny last page that brings the previous one to exactly the maximum", () => {
    expect(toPages(paras(120, 190, 40)).map(pageWords)).toEqual([MAX_PAGE_WORDS]);
  });

  it("does not merge a tiny last page when that would exceed the maximum", () => {
    expect(toPages(paras(120, 230, 40)).map(pageWords)).toEqual([350, 40]);
  });

  it("starts each page with the next token after the previous page", () => {
    const pages = toPages(text(1, 100, 10));
    for (let k = 1; k < pages.length; k++) {
      const prevLast = pages[k - 1].at(-1)!.at(-1)!.index;
      expect(pages[k][0][0].index).toBe(prevLast + 1);
    }
  });
});

describe("pageOfToken", () => {
  const tokens = text(1, 100, 10);
  let pages: ReaderPage[] = [];
  beforeEach(() => {
    pages = toPages(tokens);
  });

  it("finds the page holding a token", () => {
    expect(pageOfToken(pages, 0)).toBe(1);
    const firstOnPage2 = pages[1][0][0].index;
    expect(pageOfToken(pages, firstOnPage2)).toBe(2);
    expect(pageOfToken(pages, firstOnPage2 - 1)).toBe(1);
    expect(pageOfToken(pages, tokens.length - 1)).toBe(pages.length);
  });

  it("returns the last page for an index past the end and the first for one before the start", () => {
    expect(pageOfToken(pages, tokens.length + 50)).toBe(pages.length);
    expect(pageOfToken(pages, -1)).toBe(1);
  });

  it("returns 1 when there are no pages", () => {
    expect(pageOfToken([], 5)).toBe(1);
  });
});

describe("parsePage", () => {
  it("reads a positive whole number", () => {
    expect(parsePage("3")).toBe(3);
    expect(parsePage("1")).toBe(1);
  });

  it("returns null for anything else", () => {
    for (const raw of [null, undefined, "", "abc", "2.5", "-1", "3x", " 4"]) expect(parsePage(raw)).toBeNull();
  });

  it("keeps zero so it can be clamped to the first page", () => {
    expect(parsePage("0")).toBe(0);
  });
});

describe("resolvePage", () => {
  it("uses the URL page, clamped to the range", () => {
    expect(resolvePage("3", null, 5)).toBe(3);
    expect(resolvePage("99", null, 5)).toBe(5);
    expect(resolvePage("0", null, 5)).toBe(1);
    expect(resolvePage("5", null, 5)).toBe(5);
  });

  it("treats an invalid URL page as the first page, without falling back to the saved one", () => {
    expect(resolvePage("abc", "4", 5)).toBe(1);
  });

  it("prefers the URL page over the saved one", () => {
    expect(resolvePage("2", "4", 5)).toBe(2);
  });

  it("falls back to the saved page when the URL has none", () => {
    expect(resolvePage(null, "4", 5)).toBe(4);
    expect(resolvePage(undefined, "4", 5)).toBe(4);
    expect(resolvePage(null, "9", 5)).toBe(5);
    expect(resolvePage(null, "junk", 5)).toBe(1);
    expect(resolvePage(null, null, 5)).toBe(1);
  });

  it("is always 1 for a text with one page or none", () => {
    expect(resolvePage("3", "2", 1)).toBe(1);
    expect(resolvePage("3", null, 0)).toBe(1);
  });

  it("checks the page sizes are consistent", () => {
    expect(SINGLE_PAGE_MAX_WORDS).toBeGreaterThan(PAGE_WORDS);
    expect(MAX_PAGE_WORDS).toBeGreaterThan(SINGLE_PAGE_MAX_WORDS);
  });
});

describe("pageRange", () => {
  let pages: ReaderPage[] = [];
  beforeEach(() => {
    pages = toPages(text(1, 100, 10));
  });

  it("spans the first to the last token index of the page", () => {
    expect(pageRange(pages[0])).toEqual({ from: 0, to: pages[1][0][0].index - 1 });
    const last = pages.at(-1)!;
    expect(pageRange(last)!.to).toBe(text(1, 100, 10).length - 1);
  });

  it("is null for an empty page", () => {
    expect(pageRange([])).toBeNull();
  });
});

describe("pageTokens and unseenOnPage", () => {
  const tokens = build(["Uno", " ", "dos", " ", "uno", ". ", "tres", " ", "cuatro", "."]);
  let page: ReaderPage = [];
  beforeEach(() => {
    page = toPages(tokens)[0];
  });

  it("lists a page's tokens in order", () => {
    expect(pageTokens(page).filter((t) => t.word).map((t) => t.text)).toEqual(["Uno", "dos", "uno", "tres", "cuatro"]);
  });

  it("counts distinct words on the page with no status", () => {
    expect(unseenOnPage(page, {})).toBe(4);
    expect(unseenOnPage(page, { uno: "learning", dos: "known", tres: "ignored" })).toBe(1);
    expect(unseenOnPage(page, { uno: "known", dos: "known", tres: "known", cuatro: "learning" })).toBe(0);
    expect(unseenOnPage([], {})).toBe(0);
  });
});

