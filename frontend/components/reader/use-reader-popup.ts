"use client";

import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import type { Token } from "@/lib/types";
import { fixedDocks } from "./docks";
import { popupLeft, popupTop } from "./popup-place";
import { reservedBelow } from "./reader-fit";
import { MAX_PHRASE_WORDS, normalizePhrase, phraseRange, textAround, type Range } from "./reader-text";
import type { PopupTarget } from "./word-popup";

const POPUP_WIDTH = 352;

export function usePopupState(articleRef: RefObject<HTMLDivElement | null>, popupRef: RefObject<HTMLDivElement | null>) {
  const [sel, setSel] = useState<Range | null>(null);
  const [target, setTarget] = useState<PopupTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [phraseMode, setPhraseMode] = useState(false);
  const anchorToken = useRef<number | null>(null);

  const position = useCallback(() => {
    const container = articleRef.current;
    const popup = popupRef.current;
    const word = container?.querySelector<HTMLElement>(`[data-i="${anchorToken.current}"]`);
    if (!container || !popup || !word) return;
    const c = container.getBoundingClientRect();
    const r = word.getBoundingClientRect();
    const width = Math.min(POPUP_WIDTH, c.width);
    const left = popupLeft(r.left - c.left, width, c.width);
    const docked = reservedBelow(window.innerHeight, { left: c.left + left, right: c.left + left + width }, fixedDocks());
    const view = { top: 0, bottom: window.innerHeight - docked };
    popup.style.setProperty("--pmh", `${view.bottom - view.top}px`);
    const top = popupTop(r, popup.getBoundingClientRect().height, view);
    popup.style.setProperty("--pt", `${top - c.top}px`);
    popup.style.setProperty("--pl", `${left}px`);
  }, [articleRef, popupRef]);

  const place = useCallback(
    (tokenIndex: number) => {
      anchorToken.current = tokenIndex;
      position();
    },
    [position],
  );

  const close = useCallback(() => {
    setTarget(null);
    setSel(null);
    setNotice(null);
    setPhraseMode(false);
  }, []);

  return { sel, setSel, target, setTarget, notice, setNotice, phraseMode, setPhraseMode, place, position, close };
}

export function useKeepPopupPlaced(popupRef: RefObject<HTMLDivElement | null>, position: () => void, shown: PopupTarget | null) {
  useLayoutEffect(() => {
    const popup = popupRef.current;
    if (!shown || !popup) return;
    position();
    const observer = new ResizeObserver(position);
    observer.observe(popup);
    window.addEventListener("resize", position);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", position);
    };
  }, [popupRef, position, shown]);
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
  const { setSel, setNotice, setPhraseMode, setTarget, target, sel } = popup;

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
    (i: number, autoSaveWord: boolean, back?: PopupTarget["back"]) => {
      const t = tokens[i];
      if (!t?.word) return;
      const sentence = sentences.get(t.sentence) ?? "";
      const around = textAround(tokens, i, i);
      open({ kind: "word", term: t.normalized!, display: t.text, reading: t.reading, sentence, around, startToken: i, back }, { start: i, end: i });
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
      const words = slice.filter((t) => t.word).map((t) => ({ index: t.index, text: t.text, term: t.normalized! }));
      open({ kind: "phrase", term: normalizePhrase(display), display, sentence, around, startToken: range.start, words }, range);
    },
    [tokens, sentences, openWord, open, onError],
  );

  const openWordOfPhrase = useCallback(
    (i: number) => {
      if (target?.kind === "phrase" && sel) openWord(i, false, { display: target.display, range: sel });
    },
    [target, sel, openWord],
  );

  const backToPhrase = useCallback(() => {
    if (target?.back) openPhrase(target.back.range.start, target.back.range.end);
  }, [target, openPhrase]);

  return { openWord, openPhrase, openWordOfPhrase, backToPhrase };
}
