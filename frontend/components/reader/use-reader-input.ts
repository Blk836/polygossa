"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { Token, WordStatus } from "@/lib/types";
import { mediaShortcut, type MediaShortcut } from "./media-nav";
import { nextWord, type Range } from "./reader-text";

interface Options {
  tokens: Token[];
  sel: Range | null;
  setSel: (r: Range) => void;
  /** Whether a popup is open, and for a single word. */
  popup: "word" | "phrase" | null;
  phraseMode: boolean;
  openWord: (i: number, autoSave: boolean) => void;
  openPhrase: (a: number, b: number) => void;
  setStatus: (status: WordStatus | null) => void;
  close: () => void;
  articleRef: RefObject<HTMLDivElement | null>;
  popupRef: RefObject<HTMLDivElement | null>;
  /** ←/→ with no popup open turn the page. */
  turnPage: (dir: 1 | -1) => void;
}

/** Keys that set a status while a popup is open. */
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

/** Esc closes the popup, L/K/I/X set the status, ←/→ move to the neighbouring word. */
function handleKey(e: KeyboardEvent, o: Options) {
  const key = e.key.toLowerCase();
  if (key === "escape") return o.close();
  if (key in STATUS_KEYS) return o.setStatus(STATUS_KEYS[key]);
  const dir = ARROWS[key];
  if (!dir) return;
  e.preventDefault();
  const i = nextWord(o.tokens, o.sel?.start ?? 0, dir);
  if (i !== null) o.openWord(i, false); // opening scrolls to the word, turning the page if needed
}

/**
 * Reader input: click a word to look it up (click again to dismiss), drag or shift-click to select a phrase, tap
 * outside to close, and keyboard shortcuts (Esc, L/K/I/X, ←/→ between words, or between pages with no popup).
 */
export function useReaderInput(o: Options) {
  const drag = useRef<{ anchor: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
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
      latest.current.openPhrase(d.anchor, wordIndex(e.target) ?? d.anchor);
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
      e.preventDefault(); // stop the browser starting a text selection
      drag.current = { anchor: i, moved: false };
    },
    onPointerOver(e: React.PointerEvent) {
      const d = drag.current;
      const i = wordIndex(e.target);
      if (!d || i === null || i === d.anchor) return;
      d.moved = true;
      o.setSel({ start: Math.min(d.anchor, i), end: Math.max(d.anchor, i) });
    },
    onClick(e: React.MouseEvent) {
      if (suppressClick.current) {
        suppressClick.current = false;
        return;
      }
      const i = wordIndex(e.target);
      if (i === null) return;
      if ((e.shiftKey || o.phraseMode) && o.sel) return o.openPhrase(o.sel.start, i);
      const sameWord = o.popup === "word" && o.sel?.start === i && o.sel.end === i;
      if (sameWord) return o.close(); // tap the selected word again to dismiss
      o.openWord(i, true);
    },
  };
}

/**
 * Playback shortcuts while audio or video is available: Space, R, [ and ]. Keys already handled (tap-sync claims
 * Space) and focused buttons (Space presses them) are left alone.
 */
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
