import type { Token } from "@/lib/types";
import type { ReaderPage } from "./reader-pages";

export interface WordBox {
  index: number;
  top: number;
  bottom: number;
  paragraphEnd: boolean;
  sentenceEnd: boolean;
}

export interface FitOptions {
  height: number;
  maxWords: number;
  singlePageMaxWords: number;
  lastExtra: number;
}

const SENTENCE_FINAL = /[.!?…。！？]/;

export function wordBreaks(paragraphs: Token[][]): Omit<WordBox, "top" | "bottom">[] {
  const out: Omit<WordBox, "top" | "bottom">[] = [];
  for (const p of paragraphs) {
    let last: (typeof out)[number] | null = null;
    for (const t of p) {
      if (t.word) {
        last = { index: t.index, paragraphEnd: false, sentenceEnd: false };
        out.push(last);
      } else if (last && SENTENCE_FINAL.test(t.text)) {
        last.sentenceEnd = true;
      }
    }
    if (last) last.paragraphEnd = true;
  }
  return out;
}

function lastFitting(words: WordBox[], s: number, height: number, maxWords: number): number {
  let e = s;
  while (e + 1 < words.length && e + 1 - s < maxWords && words[e + 1].bottom - words[s].top <= height) e++;
  return e;
}

function niceBreak(words: WordBox[], s: number, e: number): number {
  const min = s + Math.ceil(((e - s + 1) * 3) / 4) - 1;
  for (const key of ["paragraphEnd", "sentenceEnd"] as const) {
    for (let k = e; k >= min; k--) if (words[k][key]) return k;
  }
  return e;
}

function pageEnd(words: WordBox[], s: number, o: FitOptions): number {
  let e = lastFitting(words, s, o.height, o.maxWords);
  if (e === words.length - 1) e = lastFitting(words, s, o.height - o.lastExtra, o.maxWords);
  return niceBreak(words, s, e);
}

export function fitPages(words: WordBox[], o: FitOptions): number[] {
  if (words.length === 0) return [];
  const all = words[words.length - 1].bottom - words[0].top + o.lastExtra;
  if (words.length <= o.singlePageMaxWords && all <= o.height) return [words[0].index];
  const starts: number[] = [];
  for (let s = 0; s < words.length; s = pageEnd(words, s, o) + 1) starts.push(words[s].index);
  return starts;
}

export function splitPages(paragraphs: Token[][], starts: number[]): ReaderPage[] {
  if (starts.length === 0) return [];
  const pages: ReaderPage[] = [[]];
  let next = 1;
  for (const p of paragraphs) {
    let current: Token[] = [];
    for (const t of p) {
      if (t.index >= (starts[next] ?? Infinity)) {
        if (current.length > 0) pages[pages.length - 1].push(current);
        pages.push([]);
        current = [];
        next++;
      }
      current.push(t);
    }
    pages[pages.length - 1].push(current);
  }
  return pages;
}

export interface Dock {
  top: number;
  left: number;
  right: number;
}

export function reservedBelow(windowHeight: number, text: { left: number; right: number }, docks: Dock[]): number {
  let reserved = 0;
  for (const d of docks) {
    if (d.left < text.right && d.right > text.left) reserved = Math.max(reserved, windowHeight - d.top);
  }
  return reserved;
}
