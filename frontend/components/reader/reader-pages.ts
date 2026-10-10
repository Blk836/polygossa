import type { Token, WordStatus } from "@/lib/types";
import { toParagraphs } from "./reader-text";

export const PAGE_WORDS = 250;
export const SINGLE_PAGE_MAX_WORDS = 300;
export const MAX_PAGE_WORDS = 350;
export const MIN_LAST_PAGE_WORDS = 50;

export type ReaderPage = Token[][];

export function wordCount(tokens: Token[]): number {
  let n = 0;
  for (const t of tokens) if (t.word) n++;
  return n;
}

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

function splitParagraph(p: Token[]): Token[][] {
  if (wordCount(p) <= PAGE_WORDS) return [p];
  const sentences = splitBefore(p, (t, prev) => t.sentence !== prev.sentence);
  const pieces = sentences.flatMap((s) => splitBefore(s, (t, _prev, words) => t.word && words >= PAGE_WORDS));
  return pack(pieces, wordCount).map((group) => group.flat());
}

const pageWords = (page: ReaderPage) => page.reduce((n, p) => n + wordCount(p), 0);

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

export function pageOfToken(pages: ReaderPage[], index: number): number {
  for (let k = 0; k < pages.length; k++) {
    const page = pages[k];
    const lastPara = page[page.length - 1];
    if (lastPara[lastPara.length - 1].index >= index) return k + 1;
  }
  return Math.max(1, pages.length);
}

export function parsePage(raw: string | null | undefined): number | null {
  return raw && /^\d+$/.test(raw) ? Number(raw) : null;
}

export function resolvePage(fromUrl: string | null | undefined, saved: string | null | undefined, count: number): number {
  const raw = fromUrl === null || fromUrl === undefined ? saved : fromUrl;
  const page = parsePage(raw) ?? 1;
  return Math.max(1, Math.min(count, page));
}

export function pageTokens(page: ReaderPage): Token[] {
  return page.flat();
}

export function pageRange(page: ReaderPage): { from: number; to: number } | null {
  const tokens = pageTokens(page);
  if (tokens.length === 0) return null;
  return { from: tokens[0].index, to: tokens[tokens.length - 1].index };
}

export function unseenOnPage(page: ReaderPage, statuses: Record<string, WordStatus>): number {
  const unseen = new Set<string>();
  for (const t of pageTokens(page)) if (t.word && !statuses[t.normalized!]) unseen.add(t.normalized!);
  return unseen.size;
}
