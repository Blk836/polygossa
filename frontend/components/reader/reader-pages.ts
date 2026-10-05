// Splits a text into reader pages: about PAGE_WORDS words each, broken at paragraph ends where possible, else at
// sentence ends (transcripts often have no paragraphs), else between words.
import type { Token, WordStatus } from "@/lib/types";
import { toParagraphs } from "./reader-text";

/** Target words per page: about a screen of reading, or under two minutes of speech. */
export const PAGE_WORDS = 250;
/** Texts up to this long stay on one page. */
export const SINGLE_PAGE_MAX_WORDS = 300;
/** No page holds more words than this. */
export const MAX_PAGE_WORDS = 350;
/** A last page shorter than this joins the previous page (if that stays within the maximum). */
export const MIN_LAST_PAGE_WORDS = 50;

/** A page is a list of paragraphs, each a list of tokens. */
export type ReaderPage = Token[][];

export function wordCount(tokens: Token[]): number {
  let n = 0;
  for (const t of tokens) if (t.word) n++;
  return n;
}

/**
 * Greedy packing: an item joins the current group when that brings the group nearer the target without passing
 * the maximum; otherwise it starts a new group.
 */
function pack<T>(items: T[], words: (item: T) => number): T[][] {
  const groups: T[][] = [];
  let current: T[] = [];
  let count = 0;
  for (const item of items) {
    const w = words(item);
    const joined = count + w;
    const fits = joined <= MAX_PAGE_WORDS && Math.abs(joined - PAGE_WORDS) < Math.abs(count - PAGE_WORDS);
    if (current.length > 0 && !fits) {
      groups.push(current);
      current = [];
      count = 0;
    }
    current.push(item);
    count += w;
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

/** Splits tokens before a word whenever the current piece already holds `size` words, or when `breakAt` says so. */
function splitBefore(tokens: Token[], breakAt: (t: Token, prev: Token, words: number) => boolean): Token[][] {
  const pieces: Token[][] = [];
  let current: Token[] = [];
  let words = 0;
  for (const t of tokens) {
    if (current.length > 0 && breakAt(t, current[current.length - 1], words)) {
      pieces.push(current);
      current = [];
      words = 0;
    }
    current.push(t);
    if (t.word) words++;
  }
  if (current.length > 0) pieces.push(current);
  return pieces;
}

/** A paragraph longer than a page becomes several, split at sentence ends (or between words in a huge sentence). */
function splitParagraph(p: Token[]): Token[][] {
  if (wordCount(p) <= PAGE_WORDS) return [p];
  const sentences = splitBefore(p, (t, prev) => t.sentence !== prev.sentence);
  const pieces = sentences.flatMap((s) => splitBefore(s, (t, _prev, words) => t.word && words >= PAGE_WORDS));
  return pack(pieces, wordCount).map((group) => group.flat());
}

const pageWords = (page: ReaderPage) => page.reduce((n, p) => n + wordCount(p), 0);

/** Word-count pages (what the server renders before the browser fits pages to the screen). */
export function toPages(tokens: Token[], paragraphs = toParagraphs(tokens)): ReaderPage[] {
  if (paragraphs.length === 0) return [];
  if (wordCount(tokens) <= SINGLE_PAGE_MAX_WORDS) return [paragraphs];
  const pages = pack(paragraphs.flatMap(splitParagraph), wordCount);
  const last = pages[pages.length - 1];
  const prev = pages[pages.length - 2];
  const lastWords = pageWords(last);
  if (prev && lastWords < MIN_LAST_PAGE_WORDS && pageWords(prev) + lastWords <= MAX_PAGE_WORDS) {
    pages.pop();
    prev.push(...last);
  }
  return pages;
}

/** 1-based number of the page holding token `index` (the nearest page for an index outside the text). */
export function pageOfToken(pages: ReaderPage[], index: number): number {
  for (let k = 0; k < pages.length; k++) {
    const page = pages[k];
    const lastPara = page[page.length - 1];
    if (lastPara[lastPara.length - 1].index >= index) return k + 1;
  }
  return Math.max(1, pages.length);
}

/** A page number from the URL or storage: a whole number, or null if it isn't one. */
export function parsePage(raw: string | null | undefined): number | null {
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

/**
 * The page to show: the URL's `?page=` if present (an invalid one means the first page), else the page saved for
 * this text, else the first; always within 1..count.
 */
export function resolvePage(fromUrl: string | null | undefined, saved: string | null | undefined, count: number): number {
  const raw = fromUrl === null || fromUrl === undefined ? saved : fromUrl;
  const page = parsePage(raw) ?? 1;
  return Math.max(1, Math.min(count, page));
}

/** A page's tokens in order. */
export function pageTokens(page: ReaderPage): Token[] {
  return page.flat();
}

/** First and last token index on a page (null for an empty page). */
export function pageRange(page: ReaderPage): { from: number; to: number } | null {
  const tokens = pageTokens(page);
  if (tokens.length === 0) return null;
  return { from: tokens[0].index, to: tokens[tokens.length - 1].index };
}

/** Distinct words on a page that have no status yet: what turning the page would mark known. */
export function unseenOnPage(page: ReaderPage, statuses: Record<string, WordStatus>): number {
  const unseen = new Set<string>();
  for (const t of pageTokens(page)) if (t.word && !statuses[t.normalized!]) unseen.add(t.normalized!);
  return unseen.size;
}
