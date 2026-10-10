"use client";

import { useCallback, useState, type RefObject } from "react";
import type { Token } from "@/lib/types";
import { normalizePhrase, phraseRange, textAround, type Range } from "./reader-text";
import type { PopupTarget } from "./word-popup";

const MAX_PHRASE_WORDS = 12;
const POPUP_WIDTH = 352;

export function usePopupState(articleRef: RefObject<HTMLDivElement | null>) {
  const [sel, setSel] = useState<Range | null>(null);
  const [target, setTarget] = useState<PopupTarget | null>(null);
  const [anchor, setAnchor] = useState({ top: 0, left: 0 });
  const [notice, setNotice] = useState<string | null>(null);
  const [phraseMode, setPhraseMode] = useState(false);

  const place = useCallback(
    (tokenIndex: number) => {
      const container = articleRef.current;
      const el = container?.querySelector<HTMLElement>(`[data-i="${tokenIndex}"]`);
      if (!container || !el) return;
      const c = container.getBoundingClientRect();
      const r = el.getBoundingClientRect();
      const width = Math.min(POPUP_WIDTH, c.width);
      setAnchor({ top: r.bottom - c.top + 8, left: Math.max(0, Math.min(r.left - c.left, c.width - width)) });
    },
    [articleRef],
  );

  const close = useCallback(() => {
    setTarget(null);
    setSel(null);
    setNotice(null);
    setPhraseMode(false);
  }, []);

  return { sel, setSel, target, setTarget, anchor, notice, setNotice, phraseMode, setPhraseMode, place, close };
}

type PopupState = ReturnType<typeof usePopupState>;

interface OpenerOptions {
  tokens: Token[];
  sentences: Map<number, string>;
  popup: PopupState;
  reveal: (token: number) => void;
  autoSave: (t: Token, sentence: string) => void;
  onError: (message: string) => void;
  onOpen: () => void;
}

export function usePopupOpeners({ tokens, sentences, popup, reveal, autoSave, onError, onOpen }: OpenerOptions) {
  const { setSel, setNotice, setPhraseMode, setTarget } = popup;

  const open = useCallback(
    (next: PopupTarget, range: Range) => {
      setSel(range);
      setNotice(null);
      setPhraseMode(false);
      setTarget(next);
      reveal(range.start);
      onOpen();
    },
    [setSel, setNotice, setPhraseMode, setTarget, reveal, onOpen],
  );

  const openWord = useCallback(
    (i: number, autoSaveWord: boolean) => {
      const t = tokens[i];
      if (!t?.word) return;
      const sentence = sentences.get(t.sentence) ?? "";
      const around = textAround(tokens, i, i);
      open({ kind: "word", term: t.normalized!, display: t.text, reading: t.reading, sentence, around, startToken: i }, { start: i, end: i });
      if (autoSaveWord) autoSave(t, sentence);
    },
    [tokens, sentences, open, autoSave],
  );

  const openPhrase = useCallback(
    (a: number, b: number) => {
      const range = phraseRange(tokens, a, b);
      if (!range) return;
      if (range.start === range.end) return openWord(range.start, true);
      const slice = tokens.slice(range.start, range.end + 1);
      if (slice.filter((t) => t.word).length > MAX_PHRASE_WORDS) {
        onError(`Phrases can be at most ${MAX_PHRASE_WORDS} words.`);
        return;
      }
      const display = slice.map((t) => t.text).join("").replace(/\s+/g, " ").trim();
      const sentence = sentences.get(tokens[range.start].sentence) ?? "";
      const around = textAround(tokens, range.start, range.end);
      open({ kind: "phrase", term: normalizePhrase(display), display, sentence, around, startToken: range.start }, range);
    },
    [tokens, sentences, openWord, open, onError],
  );

  return { openWord, openPhrase };
}
