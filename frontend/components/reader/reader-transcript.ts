import type { Token } from "@/lib/types";

export const TRANSCRIPT_PARAGRAPH_WORDS = 50;

const SENTENCE_END = /[.!?…。！？][”’"'»)\]」』]*(?:\s|$)/;
const BLANK_LINE = /\n[^\S\n]*\n/;

const flow = (text: string) => text.replace(/\s*\n\s*/g, " ");

function cut(text: string, at: number, rest: number): [string, string] {
  return [flow(text.slice(0, at)).trimEnd(), flow(text.slice(rest)).trimStart()];
}

function paragraphBreak(text: string, words: number): [string, string] | null {
  const blank = BLANK_LINE.exec(text);
  if (blank) return cut(text, blank.index, blank.index + blank[0].length);
  const end = words >= TRANSCRIPT_PARAGRAPH_WORDS ? SENTENCE_END.exec(text) : null;
  if (end) return cut(text, end.index + end[0].length, end.index + end[0].length);
  const line = text.lastIndexOf("\n");
  if (words >= 2 * TRANSCRIPT_PARAGRAPH_WORDS && line >= 0) return cut(text, line, line + 1);
  return null;
}

export function transcriptParagraphs(tokens: Token[]): Token[][] {
  const out: Token[][] = [];
  let current: Token[] = [];
  let words = 0;
  const add = (t: Token, text: string) => {
    if (text) current.push({ ...t, text });
  };
  for (const t of tokens) {
    if (t.word) {
      current.push(t);
      words++;
      continue;
    }
    const split = paragraphBreak(t.text, words);
    if (!split) {
      add(t, flow(t.text));
      continue;
    }
    add(t, split[0]);
    if (current.length > 0) out.push(current);
    current = [];
    words = 0;
    add(t, split[1]);
  }
  if (current.length > 0) out.push(current);
  return out;
}
