import { describe, expect, it } from "vitest";
import type { Token } from "@/lib/types";
import { learningEdges, normalizePhrase, overlapping, sentenceHere, phraseMarks, phraseRange, readerStats, sentenceTexts, textAround, toParagraphs } from "./reader-text";

function tokens(...parts: (string | [string, number])[]): Token[] {
  return parts.map((p, index) => {
    const [text, sentence] = typeof p === "string" ? [p, 0] : p;
    const word = /\p{L}/u.test(text);
    return { index, text, word, normalized: word ? text.toLowerCase() : undefined, sentence };
  });
}

describe("toParagraphs", () => {
  it("keeps punctuation that shares a token with the line break", () => {
    const t = tokens("Hola", ".\n\n", "Adiós", ".");
    const paragraphs = toParagraphs(t);
    expect(paragraphs.map((p) => p.map((x) => x.text).join(""))).toEqual(["Hola.", "Adiós."]);
    expect(paragraphs.flat().some((x) => x.text.includes("\n"))).toBe(false);
  });

  it("keeps text after the last break at the start of the next paragraph", () => {
    const p = toParagraphs(tokens("Uno", "\n— ", "dos"));
    expect(p.map((x) => x.map((y) => y.text).join(""))).toEqual(["Uno", "— dos"]);
  });

  it("drops blank paragraphs from repeated breaks and leading breaks", () => {
    const p = toParagraphs(tokens("\n\n", "Uno", "\n", "\n \n", "dos", "\n"));
    expect(p.map((x) => x.map((y) => y.text).join(""))).toEqual(["Uno", "dos"]);
  });

  it("keeps text between two breaks of one separator as a paragraph of its own", () => {
    const p = toParagraphs(tokens("en", " [", "musique", "]\n 2026. \n[", "musique", "]"));
    expect(p.map((x) => x.map((y) => y.text).join(""))).toEqual(["en [musique]", "2026.", "[musique]"]);
  });

  it("leaves tokens without breaks untouched", () => {
    const t = tokens("Uno", " ", "dos");
    expect(toParagraphs(t)).toEqual([t]);
  });

  it("returns no paragraphs for empty input", () => {
    expect(toParagraphs([])).toEqual([]);
  });
});

describe("normalizePhrase", () => {
  it("trims, collapses whitespace, lower-cases and straightens apostrophes", () => {
    expect(normalizePhrase("  Café   con\nLeche’s ")).toBe("café con leche's");
  });
});

describe("phraseMarks", () => {
  const text = tokens("Café", " ", "con", " ", "leche", ". ", "Un", " ", "café", " ", "con", " ", "leche", "!");

  it("marks every word of every occurrence, ignoring case", () => {
    const marks = phraseMarks(text, [{ term: "café con leche", status: "learning" }]);
    expect([...marks.keys()].sort((a, b) => a - b)).toEqual([0, 2, 4, 8, 10, 12]);
    expect(marks.get(0)).toBe("learning");
    expect(marks.has(6)).toBe(false);
  });

  it("does not mark separators", () => {
    const marks = phraseMarks(text, [{ term: "café con leche", status: "known" }]);
    expect(marks.has(1)).toBe(false);
  });

  it("matches curly apostrophes in the text against straight ones in the term", () => {
    const t = tokens("l’eau", " ", "claire");
    expect(phraseMarks(t, [{ term: "l'eau claire", status: "ignored" }]).size).toBe(2);
  });

  it("returns nothing when there are no phrases or no match", () => {
    expect(phraseMarks(text, []).size).toBe(0);
    expect(phraseMarks(text, [{ term: "té verde", status: "learning" }]).size).toBe(0);
  });

  it("stops a match at its last character", () => {
    const t = tokens("ab", " ", "c");
    expect([...phraseMarks(t, [{ term: "ab", status: "known" }]).keys()]).toEqual([0]);
  });

  it.each([" ", " ", "\n", "  ", " \n "])("matches whatever spacing %j separates the words", (gap) => {
    const t = tokens("à", " ", "voix", gap, "haute", ".");
    expect([...phraseMarks(t, [{ term: "voix haute", status: "learning" }])]).toEqual([[2, "learning"], [4, "learning"]]);
  });

  it("matches spacing and a curly apostrophe together, across tokens", () => {
    const t = tokens("Il", " ", "boit", " ", "l’", "", "eau", " ", "froide", ".");
    expect([...phraseMarks(t, [{ term: "l'eau froide", status: "learning" }]).keys()]).toEqual([4, 6, 8]);
  });

  it("does not join words that have no separator", () => {
    expect(phraseMarks(tokens("voixhaute"), [{ term: "voix haute", status: "learning" }]).size).toBe(0);
  });

  it("keeps a learning phrase marked inside a known one, whichever comes first", () => {
    const t = tokens("à", " ", "voix", " ", "haute");
    const learning = { term: "voix haute", status: "learning" as const };
    const known = { term: "à voix haute", status: "known" as const };
    for (const order of [[learning, known], [known, learning]]) {
      expect([...phraseMarks(t, order)].sort(([a], [b]) => a - b)).toEqual([[0, "known"], [2, "learning"], [4, "learning"]]);
    }
  });

  it("marks all of a learning phrase that has a known one inside it", () => {
    const t = tokens("à", " ", "voix", " ", "haute");
    const marks = phraseMarks(t, [{ term: "à voix haute", status: "learning" }, { term: "voix haute", status: "known" }]);
    expect([...marks.values()]).toEqual(["learning", "learning", "learning"]);
  });
});

describe("phraseMarks on a five-hour transcript", () => {
  const words = ["bonjour", "à", "tous", "on", "parle", "du", "marché", "de", "la", "ville"];
  const long = tokens(...Array.from({ length: 60_000 }, (_, i) => (i % 2 ? " " : words[(i / 2) % words.length])));
  const phrases = Array.from({ length: 300 }, (_, i) => ({ term: `zz${i} qq`, status: "learning" as const }))
    .concat([{ term: "du marché", status: "learning" }, { term: "la ville", status: "known" }]);

  it("finds every phrase quickly", () => {
    phraseMarks(long, phrases);
    const start = performance.now();
    const marks = phraseMarks(long, phrases);
    expect(performance.now() - start).toBeLessThan(250);
    expect(marks.size).toBe(12_000);
    expect(marks.get(10)).toBe("learning");
    expect(marks.get(16)).toBe("known");
  });
});

describe("learningEdges", () => {
  const learning = (start: number, end: number) => ({ start, end, status: "learning" as const });

  it("rounds a learning phrase at its first and last word", () => {
    expect(learningEdges([learning(2, 6)])).toEqual({ starts: new Set([2]), ends: new Set([6]) });
  });

  it("merges overlapping learning phrases into one box", () => {
    expect(learningEdges([learning(4, 8), learning(2, 4)])).toEqual({ starts: new Set([2]), ends: new Set([8]) });
  });

  it("keeps phrases that only sit side by side as separate boxes", () => {
    expect(learningEdges([learning(0, 2), learning(4, 6)])).toEqual({ starts: new Set([0, 4]), ends: new Set([2, 6]) });
  });

  it("ignores known and ignored phrases", () => {
    const spans = [{ start: 0, end: 2, status: "known" as const }, { start: 4, end: 6, status: "ignored" as const }];
    expect(learningEdges(spans)).toEqual({ starts: new Set(), ends: new Set() });
  });
});

describe("sentenceTexts", () => {
  it("joins each sentence's tokens and collapses whitespace", () => {
    const t = tokens(["Hola", 0], [" ", 0], ["mundo", 0], [".\n\n", 0], ["Otra", 1], ["  ", 1], ["vez", 1]);
    const s = sentenceTexts(t);
    expect(s.get(0)).toBe("Hola mundo.");
    expect(s.get(1)).toBe("Otra vez");
  });
});

describe("readerStats", () => {
  it("counts unique words, treating ignored as understood", () => {
    const t = tokens("Hola", " ", "Pedro", " ", "hola", " ", "mundo", " ", "nuevo");
    expect(readerStats(t, { hola: "known", pedro: "ignored", mundo: "learning" })).toEqual({
      total: 4,
      known: 2,
      learning: 1,
      unseen: 1,
      percent: 50,
    });
  });

  it("is zero for a text without words", () => {
    expect(readerStats(tokens("...", " "), {})).toEqual({ total: 0, known: 0, learning: 0, unseen: 0, percent: 0 });
  });

  it("rounds the percentage to one decimal", () => {
    const t = tokens("a", " ", "b", " ", "c");
    expect(readerStats(t, { a: "known" }).percent).toBe(33.3);
  });
});

describe("phraseRange", () => {
  const t = tokens("El", " ", "gato", ", ", "negro", ".");

  it("orders the ends and trims separators off both sides", () => {
    expect(phraseRange(t, 5, 1)).toEqual({ start: 2, end: 4 });
  });

  it("collapses to a single word", () => {
    expect(phraseRange(t, 2, 3)).toEqual({ start: 2, end: 2 });
  });

  it("returns null when the range has no words", () => {
    expect(phraseRange(t, 3, 3)).toBeNull();
  });

  it("returns null for trailing punctuation at the end of the text without reading past it", () => {
    expect(phraseRange(t, 5, 5)).toBeNull();
  });
});

describe("overlapping", () => {
  const p = tokens("a", " ", "b").map((t) => ({ ...t, index: t.index + 10 }));

  it("passes the selection and active word through only when they touch the paragraph", () => {
    expect(overlapping(p, { start: 12, end: 15 }, 11)).toEqual({ sel: { start: 12, end: 15 }, active: 11 });
    expect(overlapping(p, { start: 5, end: 10 }, 10)).toEqual({ sel: { start: 5, end: 10 }, active: 10 });
    expect(overlapping(p, { start: 13, end: 20 }, 13)).toEqual({ sel: null, active: null });
    expect(overlapping(p, { start: 1, end: 9 }, 9)).toEqual({ sel: null, active: null });
    expect(overlapping(p, null, null)).toEqual({ sel: null, active: null });
  });

  it("handles an empty paragraph", () => {
    expect(overlapping([], { start: 0, end: 1 }, 0)).toEqual({ sel: null, active: null });
  });
});

describe("sentenceHere", () => {
  const p = tokens(["a", 3], [" ", 3], ["b", 4]);

  it("passes the spoken sentence through only when the paragraph has some of it", () => {
    expect(sentenceHere(p, 3)).toBe(3);
    expect(sentenceHere(p, 4)).toBe(4);
    expect(sentenceHere(p, 2)).toBeNull();
    expect(sentenceHere(p, 5)).toBeNull();
    expect(sentenceHere(p, null)).toBeNull();
  });

  it("handles an empty paragraph", () => {
    expect(sentenceHere([], 0)).toBeNull();
  });
});

describe("edge cases", () => {
  it("trims only the whitespace between punctuation and the break", () => {
    const p = toParagraphs(tokens("Ça va", " ? \n", "Adiós"));
    expect(p.map((x) => x.map((y) => y.text).join(""))).toEqual(["Ça va ?", "Adiós"]);
  });

  it("does not mark a word that starts right where a phrase ends (no space, as in CJK)", () => {
    const t: Token[] = [
      { index: 0, text: "東京", word: true, normalized: "東京", sentence: 0 },
      { index: 1, text: "駅", word: true, normalized: "駅", sentence: 0 },
      { index: 2, text: "前", word: true, normalized: "前", sentence: 0 },
    ];
    expect([...phraseMarks(t, [{ term: "東京", status: "known" }]).keys()]).toEqual([0]);
    expect([...phraseMarks(t, [{ term: "駅", status: "known" }]).keys()]).toEqual([1]);
  });

  it("counts only learning words as learning", () => {
    const t = tokens("uno", " ", "dos", " ", "tres");
    expect(readerStats(t, { dos: "learning" })).toMatchObject({ learning: 1, unseen: 2, known: 0 });
  });

  it("keeps the last word of a paragraph active", () => {
    const p = tokens("a", " ", "b").map((t) => ({ ...t, index: t.index + 10 }));
    expect(overlapping(p, null, 12).active).toBe(12);
  });

  it("phrase ranges that start on a separator move to the next word", () => {
    expect(phraseRange(tokens("El", " ", "gato"), 1, 2)).toEqual({ start: 2, end: 2 });
  });
});

describe("textAround", () => {
  const t = tokens(["Fin", 0], [". ", 0], ["Un", 1], [" ", 1], ["os", 1], [",\n ", 1], ["un", 1], ["  ", 1], ["os", 1], [" !", 1], [" ", 2], ["Autre", 2]);

  it("gives the clicked copy's sentence before and after it, whitespace collapsed", () => {
    expect(textAround(t, 8, 8)).toEqual({ before: "Un os, un ", after: " !" });
    expect(textAround(t, 4, 4)).toEqual({ before: "Un ", after: ", un os !" });
  });

  it("gives a phrase the text around the whole selection", () => {
    expect(textAround(t, 2, 4)).toEqual({ before: "", after: ", un os !" });
  });

  it("is empty around a word that is its whole sentence", () => {
    const one = tokens(["Hola", 0], [". ", 0], ["Pedro", 1]);
    expect(textAround(one, 2, 2)).toEqual({ before: "", after: "" });
  });
});
