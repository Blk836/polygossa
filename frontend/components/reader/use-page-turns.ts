"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

type Mode = "push" | "replace";

/** What to scroll to once a page turn has rendered. */
type PendingScroll = { top: true } | { token: number; block: ScrollLogicalPosition; place: boolean };

interface Options {
  page: number;
  goTo: (n: number, mode?: Mode) => boolean;
  goToToken: (index: number, mode?: Mode) => boolean;
  articleRef: RefObject<HTMLDivElement | null>;
  /** Positions the popup under a token. */
  place: (token: number) => void;
  close: () => void;
  /** The word being spoken, if any. */
  active: number | null;
}

/**
 * Page turns in the reader. Scrolling and popup placement need the new page in the DOM, so a turn records them and
 * an effect applies them after render.
 */
export function usePageTurns({ page, goTo, goToToken, articleRef, place, close, active }: Options) {
  const pending = useRef<PendingScroll | null>(null);

  useEffect(() => {
    const p = pending.current;
    pending.current = null;
    if (!p) return;
    const raf = requestAnimationFrame(() => {
      if ("top" in p) {
        const article = articleRef.current;
        if (article && article.getBoundingClientRect().top < 0) article.scrollIntoView({ block: "start" });
        return;
      }
      articleRef.current?.querySelector(`[data-i="${p.token}"]`)?.scrollIntoView({ block: p.block });
      if (p.place) place(p.token);
    });
    return () => cancelAnimationFrame(raf);
  }, [page, place, articleRef]);

  /** Scrolls to a token, turning to its page first if needed (and then placing the popup there if asked). */
  const reveal = useCallback(
    (i: number, block: ScrollLogicalPosition, placePopup: boolean, mode: Mode = "push") => {
      if (goToToken(i, mode)) {
        pending.current = { token: i, block, place: placePopup };
        return;
      }
      articleRef.current?.querySelector(`[data-i="${i}"]`)?.scrollIntoView({ block, behavior: "smooth" });
      if (placePopup) place(i);
    },
    [goToToken, articleRef, place],
  );

  /** Pager and ←/→ page turns: close the popup and go back to the top of the text. */
  const turnPage = useCallback(
    (n: number) => {
      if (!goTo(n)) return;
      close();
      pending.current = { top: true };
    },
    [goTo, close],
  );

  // Playing audio or video (or seeking it) turns the page when the spoken word moves onto another one. Only when the
  // word changes: turning the page by hand while paused, or refitting pages, must not pull back to the word.
  const follow = useRef(goToToken);
  useEffect(() => {
    follow.current = goToToken;
  });
  useEffect(() => {
    // A jump may already have asked to scroll to the word itself, so don't replace that.
    if (active !== null && follow.current(active, "replace")) pending.current ??= { top: true };
  }, [active]);

  return { reveal, turnPage };
}
