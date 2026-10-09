// Pages that fit the screen: given where each word of the whole text lands when laid out at the reader's width
// (measured in the browser), cut it into pages no taller than the room left for the text, so a page never scrolls.
import type { Token } from "@/lib/types";
import type { ReaderPage } from "./reader-pages";

/** A word's line box in the laid-out text (px from its top), and whether a page could end nicely after it. */
export interface WordBox {
  /** Token index. */
  index: number;
  top: number;
  bottom: number;
  paragraphEnd: boolean;
  sentenceEnd: boolean;
}

export interface FitOptions {
  /** Room for the text, in px. */
  height: number;
  /** No page holds more words than this. */
  maxWords: number;
  /** Texts up to this long stay on one page if they fit. */
  singlePageMaxWords: number;
  /** Room the last page also needs below the text (the finish panel), in px. */
  lastExtra: number;
}

const SENTENCE_FINAL = /[.!?…。！？]/;

/** Each word with whether it ends its paragraph, or is followed by sentence-final punctuation. */
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

/** The last word from `s` that fits in `height` px and the word cap. Always at least `s` itself. */
function lastFitting(words: WordBox[], s: number, height: number, maxWords: number): number {
  let e = s;
  while (e + 1 < words.length && e + 1 - s < maxWords && words[e + 1].bottom - words[s].top <= height) e++;
  return e;
}

/** The latest paragraph end, else sentence end, in the page's last quarter; else the page's last word. */
function niceBreak(words: WordBox[], s: number, e: number): number {
  const min = s + Math.ceil(((e - s + 1) * 3) / 4) - 1;
  for (const key of ["paragraphEnd", "sentenceEnd"] as const) {
    for (let k = e; k >= min; k--) if (words[k][key]) return k;
  }
  return e;
}

/** The page from `s` ends here. The text's last word ends a paragraph, so niceBreak keeps a page that reaches it. */
function pageEnd(words: WordBox[], s: number, o: FitOptions): number {
  let e = lastFitting(words, s, o.height, o.maxWords);
  // The last page also needs room for what follows it (if it doesn't get that, the rest goes on another page).
  if (e === words.length - 1) e = lastFitting(words, s, o.height - o.lastExtra, o.maxWords);
  return niceBreak(words, s, e);
}

/** Token index of the first word of each page. */
export function fitPages(words: WordBox[], o: FitOptions): number[] {
  if (words.length === 0) return [];
  const all = words[words.length - 1].bottom - words[0].top + o.lastExtra;
  if (words.length <= o.singlePageMaxWords && all <= o.height) return [words[0].index];
  const starts: number[] = [];
  for (let s = 0; s < words.length; s = pageEnd(words, s, o) + 1) starts.push(words[s].index);
  return starts;
}

/**
 * Cuts the text's paragraphs into pages starting at the given words. Separators go with the page before; anything
 * before the first word is on the first page.
 */
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
    pages[pages.length - 1].push(current); // paragraphs are never empty, so neither is their last piece
  }
  return pages;
}

/** A box docked at the bottom of the window (the player bar, a floating video), in px from the window's top-left. */
export interface Dock {
  top: number;
  left: number;
  right: number;
}

/**
 * How much of the window's bottom the text must leave free: up to the highest dock that overlaps the text column
 * sideways. The player bar spans the window; a floating video in the margin beside the text doesn't count.
 */
export function reservedBelow(windowHeight: number, text: { left: number; right: number }, docks: Dock[]): number {
  let reserved = 0;
  for (const d of docks) {
    if (d.left < text.right && d.right > text.left) reserved = Math.max(reserved, windowHeight - d.top);
  }
  return reserved;
}
