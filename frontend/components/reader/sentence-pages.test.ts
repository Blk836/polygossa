import { describe, expect, it } from "vitest";
import type { Token } from "@/lib/types";
import { pageOfToken, sentencePages } from "./reader-pages";
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

const wordIndexes = (tokens: Token[]) => tokens.filter((t) => t.word).map((t) => t.index);

describe("sentencePages", () => {
  it("makes each sentence a page of its own, in order, losing no word", () => {
    const tokens = text(2, 3, 4);
    const pages = sentencePages(toParagraphs(tokens));
    expect(pages).toHaveLength(6);
    for (const p of pages) expect(p).toHaveLength(1);
    expect(pages.map((p) => new Set(p[0].map((t) => t.sentence)).size)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(pages.flatMap((p) => wordIndexes(p[0]))).toEqual(wordIndexes(tokens));
  });

  it("drops the paragraph break, keeping the full stop with its sentence", () => {
    const pages = sentencePages(toParagraphs(text(2, 1, 2)));
    expect(pages.map((p) => p[0].map((t) => t.text).join(""))).toEqual(["w0x0x0 w0x0x1.", "w1x0x0 w1x0x1."]);
  });

  it("finds the page of any token, as for pages", () => {
    const tokens = text(1, 3, 2);
    const pages = sentencePages(toParagraphs(tokens));
    expect(pageOfToken(pages, 0)).toBe(1);
    expect(pageOfToken(pages, tokens.findIndex((t) => t.sentence === 2))).toBe(3);
  });

  it("gives one page for a one-sentence lesson and none for an empty one", () => {
    expect(sentencePages(toParagraphs(text(1, 1, 5)))).toHaveLength(1);
    expect(sentencePages([])).toEqual([]);
  });

  it("joins a stray piece with no words to the sentence before it", () => {
    const tokens = build(["Uno", ". "]).concat([{ index: 2, text: "— ", word: false, sentence: 1 }, { index: 3, text: "Dos", word: true, normalized: "dos", sentence: 2 }]);
    const pages = sentencePages(toParagraphs(tokens));
    expect(pages.map((p) => p[0].map((t) => t.index))).toEqual([[0, 1, 2], [3]]);
  });
});
