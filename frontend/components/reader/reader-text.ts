import type { Token, WordStatus } from "@/lib/types";

export function normalizePhrase(s: string): string {
  return s.trim().replace(/’/g, "'").replace(/\s+/g, " ").toLowerCase();
}

export function toParagraphs(tokens: Token[]): Token[][] {
  const out: Token[][] = [[]];
  for (const t of tokens) {
    if (t.word || !t.text.includes("\n")) {
      out[out.length - 1].push(t);
      continue;
    }
    t.text.split("\n").forEach((line, k, lines) => {
      if (k > 0) out.push([]);
      const text = k === 0 ? line.trimEnd() : k === lines.length - 1 ? line.trimStart() : line.trim();
      if (text) out[out.length - 1].push({ ...t, text });
    });
  }
  return out.filter((p) => p.length > 0);
}

export const MAX_PHRASE_WORDS = 12;

export interface PhraseSpan {
  start: number;
  end: number;
  status: WordStatus;
}

export function phraseSpans(tokens: Token[], phrases: { term: string; status: WordStatus }[]): PhraseSpan[] {
  const starts: number[] = [];
  let offset = 0;
  for (const t of tokens) {
    starts.push(offset);
    offset += t.text.length;
  }
  const lower = tokens.map((t) => t.text).join("").toLowerCase().replace(/’/g, "'");
  const spans: PhraseSpan[] = [];
  for (const p of phrases) {
    for (let at = lower.indexOf(p.term); at >= 0; at = lower.indexOf(p.term, at + p.term.length)) {
      const inside = tokens.filter((t) => t.word && starts[t.index] >= at && starts[t.index] < at + p.term.length);
      if (inside.length) spans.push({ start: inside[0].index, end: inside[inside.length - 1].index, status: p.status });
    }
  }
  return spans;
}

export function phraseMarks(tokens: Token[], phrases: { term: string; status: WordStatus }[]): Map<number, WordStatus> {
  const marks = new Map<number, WordStatus>();
  for (const s of phraseSpans(tokens, phrases)) {
    for (let i = s.start; i <= s.end; i++) if (tokens[i].word) marks.set(i, s.status);
  }
  return marks;
}

export function learningGaps(tokens: Token[], spans: PhraseSpan[]): Set<number> {
  const gaps = new Set<number>();
  for (const s of spans) {
    if (s.status !== "learning") continue;
    for (let i = s.start + 1; i < s.end; i++) if (!tokens[i].word) gaps.add(i);
  }
  return gaps;
}

export interface Edges {
  starts: Set<number>;
  ends: Set<number>;
}

export function learningEdges(spans: PhraseSpan[]): Edges {
  const edges: Edges = { starts: new Set(), ends: new Set() };
  const learning = spans.filter((s) => s.status === "learning").sort((a, b) => a.start - b.start);
  let run: Range | null = null;
  for (const s of learning) {
    if (run && s.start <= run.end) {
      run.end = Math.max(run.end, s.end);
      continue;
    }
    if (run) edges.ends.add(run.end);
    edges.starts.add(s.start);
    run = { start: s.start, end: s.end };
  }
  if (run) edges.ends.add(run.end);
  return edges;
}

export function savedPhraseAt(spans: PhraseSpan[], i: number): Range | null {
  let best: PhraseSpan | null = null;
  for (const s of spans) {
    if (s.status !== "learning" || s.start === s.end || i < s.start || i > s.end) continue;
    if (!best || s.end - s.start > best.end - best.start) best = s;
  }
  return best && { start: best.start, end: best.end };
}

export function cappedRange(tokens: Token[], anchor: number, to: number, maxWords = MAX_PHRASE_WORDS): Range {
  const dir = to >= anchor ? 1 : -1;
  let words = 0;
  let last = anchor;
  for (let k = anchor; dir > 0 ? k <= to : k >= to; k += dir) {
    if (!tokens[k].word) continue;
    if (++words > maxWords) break;
    last = k;
  }
  return { start: Math.min(anchor, last), end: Math.max(anchor, last) };
}

export function sentenceTexts(tokens: Token[]): Map<number, string> {
  const m = new Map<number, string>();
  for (const t of tokens) m.set(t.sentence, (m.get(t.sentence) ?? "") + t.text);
  for (const [k, v] of m) m.set(k, v.replace(/\s+/g, " ").trim());
  return m;
}

export interface TextAround {
  before: string;
  after: string;
}

export function textAround(tokens: Token[], start: number, end: number): TextAround {
  const sentence = tokens[start]?.sentence;
  const join = (from: number, to: number) =>
    tokens.slice(from, to).filter((t) => t.sentence === sentence).map((t) => t.text).join("").replace(/\s+/g, " ");
  return { before: join(0, start).trimStart(), after: join(end + 1, tokens.length).trimEnd() };
}

export interface ReaderStats {
  total: number;
  known: number;
  learning: number;
  unseen: number;
  percent: number;
}

export function readerStats(tokens: Token[], statuses: Record<string, WordStatus>): ReaderStats {
  const unique = new Set<string>();
  for (const t of tokens) if (t.word) unique.add(t.normalized!);
  let known = 0;
  let learning = 0;
  for (const term of unique) {
    const s = statuses[term];
    if (s === "known" || s === "ignored") known++;
    else if (s === "learning") learning++;
  }
  const total = unique.size;
  const percent = total ? Math.round((known / total) * 1000) / 10 : 0;
  return { total, known, learning, unseen: total - known - learning, percent };
}

export function phraseRange(tokens: Token[], a: number, b: number): { start: number; end: number } | null {
  const hi = Math.max(a, b);
  let start = Math.min(a, b);
  while (start <= hi && !tokens[start].word) start++;
  if (start > hi) return null;
  let end = hi;
  while (!tokens[end].word) end--;
  return { start, end };
}

export interface Range {
  start: number;
  end: number;
}

export function overlapping(p: Token[], sel: Range | null, active: number | null) {
  if (!p.length) return { sel: null, active: null };
  const first = p[0].index;
  const last = p[p.length - 1].index;
  const selHere = sel !== null && sel.end >= first && sel.start <= last;
  const activeHere = active !== null && active >= first && active <= last;
  return { sel: selHere ? sel : null, active: activeHere ? active : null };
}

export function sentenceHere(p: Token[], sentence: number | null): number | null {
  if (sentence === null || !p.length) return null;
  return sentence >= p[0].sentence && sentence <= p[p.length - 1].sentence ? sentence : null;
}

export function nextWord(tokens: Token[], from: number, dir: 1 | -1): number | null {
  for (let i = from + dir; i >= 0 && i < tokens.length; i += dir) if (tokens[i].word) return i;
  return null;
}
