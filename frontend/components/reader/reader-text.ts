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

export function phraseMarks(tokens: Token[], phrases: { term: string; status: WordStatus }[]): Map<number, WordStatus> {
  const marks = new Map<number, WordStatus>();
  const starts: number[] = [];
  let offset = 0;
  for (const t of tokens) {
    starts.push(offset);
    offset += t.text.length;
  }
  const lower = tokens.map((t) => t.text).join("").toLowerCase().replace(/’/g, "'");
  for (const p of phrases) {
    for (let at = lower.indexOf(p.term); at >= 0; at = lower.indexOf(p.term, at + p.term.length)) {
      for (const t of tokens) {
        const s = starts[t.index];
        if (t.word && s >= at && s < at + p.term.length) marks.set(t.index, p.status);
      }
    }
  }
  return marks;
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
