"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Token, WordStatus } from "@/lib/types";
import { mediaShortcut, type MediaShortcut } from "./media-nav";
import { cappedRange, nextWord, type Range } from "./reader-text";

interface Options {
  tokens: Token[];
  sel: Range | null;
  setSel: (r: Range) => void;
  popup: "word" | "phrase" | null;
  phraseMode: boolean;
  openWord: (i: number, autoSave: boolean) => void;
  openPhrase: (a: number, b: number) => void;
  savedPhraseAt: (i: number) => Range | null;
  setStatus: (status: WordStatus | null) => void;
  close: () => void;
  articleRef: RefObject<HTMLDivElement | null>;
  popupRef: RefObject<HTMLDivElement | null>;
  turnPage: (dir: 1 | -1) => void;
}

const STATUS_KEYS: Record<string, WordStatus | null> = { l: "learning", "1": "learning", k: "known", i: "ignored", x: null };

function wordIndex(target: EventTarget | null): number | null {
  const el = (target as HTMLElement | null)?.closest?.("[data-i]");
  return el ? Number(el.getAttribute("data-i")) : null;
}

function isTyping(e: KeyboardEvent): boolean {
  const tag = (e.target as HTMLElement).tagName;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(tag) || e.metaKey || e.ctrlKey || e.altKey;
}

const ARROWS: Record<string, 1 | -1> = { arrowright: 1, arrowleft: -1 };

function handleKey(e: KeyboardEvent, o: Options) {
  const key = e.key.toLowerCase();
  if (key === "escape") return o.close();
  if (key in STATUS_KEYS) return o.setStatus(STATUS_KEYS[key]);
  const dir = ARROWS[key];
  if (!dir) return;
  e.preventDefault();
  const i = nextWord(o.tokens, o.sel?.start ?? 0, dir);
  if (i !== null) o.openWord(i, false);
}

function clickSavedPhrase(o: Options, i: number, lastClicked: { current: number | null }): boolean {
  const saved = o.savedPhraseAt(i);
  if (!saved) return false;
  const open = o.popup === "phrase" && o.sel?.start === saved.start && o.sel.end === saved.end;
  const again = open && lastClicked.current === i;
  lastClicked.current = i;
  if (again) return false;
  if (!open) o.openPhrase(saved.start, saved.end);
  return true;
}

function clickWord(o: Options, i: number) {
  const sameWord = o.popup === "word" && o.sel?.start === i && o.sel.end === i;
  if (sameWord) return o.close();
  o.openWord(i, true);
}

export function useReaderInput(o: Options) {
  const drag = useRef<{ anchor: number; moved: boolean; range: Range | null } | null>(null);
  const suppressClick = useRef(false);
  const lastClicked = useRef<number | null>(null);
  const latest = useRef(o);
  useEffect(() => {
    latest.current = o;
  });

  useEffect(() => {
    const onUp = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      if (!d?.moved) return;
      suppressClick.current = true;
      const range = d.range ?? cappedRange(latest.current.tokens, d.anchor, wordIndex(e.target) ?? d.anchor);
      latest.current.openPhrase(range.start, range.end);
    };
    window.addEventListener("pointerup", onUp);
    return () => window.removeEventListener("pointerup", onUp);
  }, []);

  const hasPopup = o.popup !== null;
  useEffect(() => {
    if (hasPopup) return;
    const onKey = (e: KeyboardEvent) => {
      const dir = ARROWS[e.key.toLowerCase()];
      if (!dir || isTyping(e)) return;
      e.preventDefault();
      latest.current.turnPage(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasPopup]);

  useEffect(() => {
    if (!hasPopup) return;
    const onDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement;
      if (latest.current.popupRef.current?.contains(el) || el.closest("[data-i]")) return;
      latest.current.close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isTyping(e)) handleKey(e, latest.current);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [hasPopup]);

  return {
    onPointerDown(e: React.PointerEvent) {
      const i = wordIndex(e.target);
      if (i === null || e.pointerType !== "mouse" || e.button !== 0 || e.shiftKey) return;
      e.preventDefault();
      drag.current = { anchor: i, moved: false, range: null };
    },
    onPointerOver(e: React.PointerEvent) {
      const d = drag.current;
      const i = wordIndex(e.target);
      if (!d || i === null || i === d.anchor) return;
      d.moved = true;
      d.range = cappedRange(o.tokens, d.anchor, i);
      o.setSel(d.range);
    },
    onClick(e: React.MouseEvent) {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      const i = wordIndex(e.target);
      if (i === null) return;
      if ((e.shiftKey || o.phraseMode) && o.sel) return o.openPhrase(o.sel.start, i);
      if (!clickSavedPhrase(o, i, lastClicked)) clickWord(o, i);
    },
  };
}

export function useMediaShortcuts(onShortcut: ((action: MediaShortcut) => void) | null) {
  const latest = useRef(onShortcut);
  useEffect(() => {
    latest.current = onShortcut;
  });
  const enabled = onShortcut !== null;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const action = mediaShortcut(e.key);
      const tag = (e.target as HTMLElement).tagName;
      if (!action || e.defaultPrevented || isTyping(e) || (e.key === " " && tag === "BUTTON")) return;
      e.preventDefault();
      latest.current?.(action);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
