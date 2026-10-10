"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";

type Mode = "push" | "replace";

type PendingScroll = { top: true } | { token: number; block: ScrollLogicalPosition; place: boolean };

interface Options {
  page: number;
  goTo: (n: number, mode?: Mode) => boolean;
  goToToken: (index: number, mode?: Mode) => boolean;
  follow: (index: number) => boolean;
  articleRef: RefObject<HTMLDivElement | null>;
  place: (token: number) => void;
  close: () => void;
  active: number | null;
}

export function usePageTurns({ page, goTo, goToToken, follow, articleRef, place, close, active }: Options) {
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

  const turnPage = useCallback(
    (n: number) => {
      if (!goTo(n)) return;
      close();
      pending.current = { top: true };
    },
    [goTo, close],
  );

  const following = useRef(follow);
  useEffect(() => {
    following.current = follow;
  });
  useEffect(() => {
    if (active !== null && following.current(active)) pending.current ??= { top: true };
  }, [active]);

  return { reveal, turnPage };
}
