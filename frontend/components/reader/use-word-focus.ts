"use client";

import { useEffect, useState, type FocusEvent, type KeyboardEvent, type RefObject } from "react";
import type { Token } from "@/lib/types";
import { nextWord, type Range } from "./reader-text";

const ARROWS: Record<string, 1 | -1> = { ArrowRight: 1, ArrowLeft: -1 };

const wordEl = (article: HTMLElement | null, i: number) => article?.querySelector<HTMLElement>(`[data-i="${i}"]`) ?? null;

function indexOf(target: EventTarget | null): number | null {
  const value = (target as HTMLElement | null)?.getAttribute?.("data-i");
  return value == null ? null : Number(value);
}

export function useWordFocus({ articleRef, tokens, pageWords, sel, popupOpen, activate }: {
  articleRef: RefObject<HTMLDivElement | null>;
  tokens: Token[];
  pageWords: number[];
  sel: Range | null;
  popupOpen: boolean;
  activate: (i: number) => void;
}) {
  const [focused, setFocused] = useState<number | null>(null);
  const stop = focused !== null && pageWords.includes(focused) ? focused : (pageWords[0] ?? null);
  const opened = popupOpen ? (sel?.start ?? null) : null;

  useEffect(() => {
    const article = articleRef.current;
    if (opened === null || !article?.contains(document.activeElement)) return;
    wordEl(article, opened)?.focus();
  }, [opened, articleRef]);

  function moveFocus(e: KeyboardEvent, from: number) {
    const dir = ARROWS[e.key];
    if (!dir) return;
    e.preventDefault();
    const next = nextWord(tokens, from, dir);
    if (next !== null) wordEl(articleRef.current, next)?.focus();
  }

  return {
    stop,
    onFocus(e: FocusEvent) {
      const i = indexOf(e.target);
      if (i !== null) setFocused(i);
    },
    onKeyDown(e: KeyboardEvent) {
      const i = indexOf(e.target);
      if (i === null || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        return activate(i);
      }
      if (!popupOpen) moveFocus(e, i);
    },
  };
}
