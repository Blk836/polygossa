import { describe, expect, it } from "vitest";
import type { Token } from "@/lib/types";
import { TRANSCRIPT_PARAGRAPH_WORDS as N, transcriptParagraphs } from "./reader-transcript";

function tokens(...parts: string[]): Token[] {
  let sentence = 0;
  return parts.map((text, index) => {
    const word = /\p{L}/u.test(text);
    const t: Token = { index, text, word, sentence, ...(word ? { normalized: text.toLowerCase() } : {}) };
    if (!word && /[.!?\n]/.test(text)) sentence++;
    return t;
  });
}

function captions(sentences: number, words: number, line: number, end = ". "): Token[] {
  const parts: string[] = [];
  let n = 0;
  for (let s = 0; s < sentences; s++) {
    for (let w = 0; w < words; w++) {
      parts.push(`w${s}x${w}`);
      n++;
      const last = s === sentences - 1 && w === words - 1;
      if (last) break;
      const sep = w === words - 1 ? end : " ";
      parts.push(n % line === 0 ? sep.trimEnd() + "\n" : sep);
    }
  }
  return tokens(...parts);
}

const texts = (ps: Token[][]) => ps.map((p) => p.map((t) => t.text).join(""));
const words = (ps: Token[][]) => ps.map((p) => p.filter((t) => t.word).length);

describe("transcriptParagraphs", () => {
  it("joins caption lines into flowing text", () => {
    const p = transcriptParagraphs(tokens("Je", " ", "suis", "\n", "ravi", " ", "de", "\n", "vous"));
    expect(texts(p)).toEqual(["Je suis ravi de vous"]);
  });

  it("keeps text that sits between two line breaks of one separator", () => {
    const p = transcriptParagraphs(tokens("en", " [", "musique", "]\n2026.\n[", "musique", "]"));
    expect(texts(p)).toEqual(["en [musique] 2026. [musique]"]);
  });

  it("still starts a new paragraph at a blank line, trimming the space around it", () => {
    const p = transcriptParagraphs(tokens("Uno", ". \n\n — ", "dos", "\n", "tres"));
    expect(texts(p)).toEqual(["Uno.", "— dos tres"]);
  });

  it("makes no empty paragraph from breaks at the start or the end", () => {
    expect(texts(transcriptParagraphs(tokens("Uno", ".\n\n")))).toEqual(["Uno."]);
    expect(texts(transcriptParagraphs(tokens("\n\n", "Uno")))).toEqual(["Uno"]);
    const parts: string[] = [];
    for (let w = 0; w < 2 * N; w++) parts.push(`w${w}`, " ");
    expect(texts(transcriptParagraphs(tokens(...parts.slice(0, -1), "\n")))).toHaveLength(1);
  });

  it("breaks unpunctuated captions at the line break that reaches twice the length", () => {
    expect(words(transcriptParagraphs(captions(1, 250, 10)))).toEqual([2 * N, 2 * N, 250 - 4 * N]);
  });

  it("keeps punctuation before a caption break once, at the end of the paragraph", () => {
    const parts: string[] = [];
    for (let w = 0; w < 2 * N; w++) parts.push(`w${w}`, w < 2 * N - 1 ? " " : ",\n");
    expect(texts(transcriptParagraphs(tokens(...parts, "next")))).toEqual([expect.stringMatching(new RegExp(`w${2 * N - 1},$`)), "next"]);
  });

  it("keeps the space before a French ? when ending a paragraph there", () => {
    const parts: string[] = [];
    for (let w = 0; w < N; w++) parts.push(`w${w}`, w < N - 1 ? " " : " ? « ");
    const p = texts(transcriptParagraphs(tokens(...parts, "Oui", " »")));
    expect(p[0].endsWith(`w${N - 1} ?`)).toBe(true);
    expect(p[1]).toBe("« Oui »");
  });

  it("ends a paragraph at the first sentence end once it has enough words", () => {
    const p = transcriptParagraphs(captions(12, 10, 7));
    expect(words(p)).toEqual([N, N, 120 - 2 * N]);
    expect(texts(p).slice(0, -1).every((s) => s.trimEnd().endsWith("."))).toBe(true);
  });

  it("does not end a paragraph at a sentence end before it has enough words", () => {
    const p = transcriptParagraphs(captions(3, N / 2 - 1, 4));
    expect(p).toHaveLength(1);
  });

  it("treats ? ! and … as sentence ends, but not commas", () => {
    for (const end of ["? ", "! ", "… "]) expect(words(transcriptParagraphs(captions(4, N / 2, 7, end)))).toEqual([N, N]);
    expect(transcriptParagraphs(captions(4, N / 2, 7, ", "))).toHaveLength(1);
  });

  it("breaks unpunctuated captions at a line break once a paragraph is twice as long", () => {
    const p = transcriptParagraphs(captions(1, 250, 7));
    const first = Math.ceil((2 * N) / 7) * 7;
    expect(words(p)).toEqual([first, first, 250 - 2 * first]);
  });

  it("loses no text: line breaks become spaces, and only the space at a paragraph end goes", () => {
    for (const t of [captions(12, 10, 7), captions(1, 250, 7), tokens("a", " [", "b", "]\n2026.\n[", "c", ".\n\n", "d")]) {
      const out = transcriptParagraphs(t);
      expect(out.flat().map((x) => x.text).join("").replace(/\s+/g, "")).toBe(t.map((x) => x.text).join("").replace(/\s+/g, ""));
      expect(out.flat().some((x) => x.text.includes("\n"))).toBe(false);
      for (const p of out) expect(p.map((x) => x.text).join("")).not.toMatch(/ {2}/);
    }
  });

  it("splits a separator after its full stop, so an opening bracket starts the next paragraph", () => {
    const parts: string[] = [];
    for (let w = 0; w < N; w++) parts.push(`w${w}`, w < N - 1 ? " " : ". [");
    const p = transcriptParagraphs(tokens(...parts, "musique", "]"));
    expect(texts(p)[0].endsWith(`w${N - 1}.`)).toBe(true);
    expect(texts(p)[1]).toBe("[musique]");
  });

  it("treats CJK full stops as sentence ends even with no space after them", () => {
    const parts: string[] = [];
    for (let w = 0; w < N; w++) parts.push(`字${w}`, w < N - 1 ? "、" : "。");
    expect(words(transcriptParagraphs(tokens(...parts, "次")))).toEqual([N, 1]);
  });

  it("keeps each token's index and word flag", () => {
    const t = captions(2, 5, 3);
    const out = transcriptParagraphs(t).flat();
    expect(out.map((x) => [x.index, x.word])).toEqual(t.map((x) => [x.index, x.word]));
  });

  it("returns no paragraphs for an empty transcript", () => {
    expect(transcriptParagraphs([])).toEqual([]);
  });
});
