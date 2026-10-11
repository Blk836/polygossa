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
  pageStart: number | null;
  onPage: (index: number) => boolean;
  startPage: (index: number | null) => void;
}

export function usePageTurns({ page, goTo, goToToken, follow, articleRef, place, close, active, pageStart, onPage, startPage }: Options) {
  const pending = useRef<PendingScroll | null>(null);
  const turned = useRef<number | null>(null);
  const latest = useRef({ active, onPage, startPage });
  useEffect(() => {
    latest.current = { active, onPage, startPage };
  });

  useEffect(() => {
    if (turned.current !== page || pageStart === null) return;
    const now = latest.current;
    if (now.active !== null && now.onPage(now.active)) {
      turned.current = null;
      now.startPage(null);
    } else now.startPage(pageStart);
  }, [page, pageStart]);

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
      turned.current = n;
    },
    [goTo, close],
  );

  const following = useRef(follow);
  useEffect(() => {
    following.current = follow;
  });
  useEffect(() => {
    if (active === null) return;
    if (turned.current !== null) {
      if (latest.current.onPage(active)) turned.current = null;
      return;
    }
    if (following.current(active)) pending.current ??= { top: true };
  }, [active]);

  return { reveal, turnPage };
}
