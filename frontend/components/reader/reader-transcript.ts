// Paragraphs for video transcripts. Captions put every few words on their own line, so treating each line break as
// a paragraph (as for imported texts) shows the transcript as a column of short lines; here lines flow together.
import type { Token } from "@/lib/types";

/** A transcript paragraph ends at the first sentence end once it has this many words. */
export const TRANSCRIPT_PARAGRAPH_WORDS = 50;

/** Sentence-final punctuation (with any closing quotes or brackets), then whitespace or the end of the separator. */
const SENTENCE_END = /[.!?…。！？][”’"'»)\]」』]*(?:\s|$)/;
const BLANK_LINE = /\n[^\S\n]*\n/;

const flow = (text: string) => text.replace(/\s*\n\s*/g, " ");

/** Splits a separator into the text before `at` and from `rest`, without the whitespace at the break. */
function cut(text: string, at: number, rest: number): [string, string] {
  return [flow(text.slice(0, at)).trimEnd(), flow(text.slice(rest)).trimStart()];
}

/**
 * Where a separator ends the paragraph that has `words` words so far: at a blank line; at a sentence end once the
 * paragraph is long enough; or, for captions without punctuation, at a line break once it is twice that long.
 * Returns the text before and after the break, or null to keep the paragraph going.
 */
function paragraphBreak(text: string, words: number): [string, string] | null {
  const blank = BLANK_LINE.exec(text);
  if (blank) return cut(text, blank.index, blank.index + blank[0].length);
  const end = words >= TRANSCRIPT_PARAGRAPH_WORDS ? SENTENCE_END.exec(text) : null;
  if (end) return cut(text, end.index + end[0].length, end.index + end[0].length);
  const line = text.lastIndexOf("\n");
  if (words >= 2 * TRANSCRIPT_PARAGRAPH_WORDS && line >= 0) return cut(text, line, line + 1);
  return null;
}

/** Splits a transcript's tokens into paragraphs of flowing text; no token keeps a line break. */
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
