"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import type { LanguageCode, Token } from "@/lib/types";
import { useMe } from "../me-context";
import { lookup } from "./lookup-cache";
import { NEAR_PX, nearWords, type WordBox } from "./near-words";
import { prefetchQueue } from "./prefetch-queue";
import { textAround } from "./reader-text";

interface Options {
  articleRef: RefObject<HTMLDivElement | null>;
  tokens: Token[];
  language: LanguageCode;
  page: number;
  isShown: (token: number) => boolean;
}

function outside(x: number, y: number, r: DOMRect): boolean {
  return x < r.left - NEAR_PX || x > r.right + NEAR_PX || y < r.top - NEAR_PX || y > r.bottom + NEAR_PX;
}

function blueWords(root: HTMLElement, isShown: (token: number) => boolean): WordBox[] {
  const boxes: WordBox[] = [];
  for (const el of root.querySelectorAll<HTMLElement>(".w-new[data-i]")) {
    const index = Number(el.dataset.i);
    if (!isShown(index)) continue;
    const r = el.getBoundingClientRect();
    boxes.push({ index, left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }
  return boxes;
}

export function useNearPrefetch({ articleRef, tokens, language, page, isShown }: Options) {
  const { me } = useMe();
  const native = me.nativeLanguage;
  const queue = useMemo(
    () => prefetchQueue((key) => {
      const i = Number(key);
      return lookup(language, tokens[i].text, native, textAround(tokens, i, i));
    }),
    [tokens, language, native],
  );
  const shown = useRef(isShown);
  useEffect(() => {
    shown.current = isShown;
  }, [isShown]);

  useEffect(() => {
    queue.clear();
  }, [queue, page]);

  useEffect(() => {
    let frame = 0;
    let x = 0;
    let y = 0;
    const scan = () => {
      frame = 0;
      const root = articleRef.current;
      if (!root || outside(x, y, root.getBoundingClientRect())) return queue.want([]);
      queue.want(nearWords(x, y, blueWords(root, shown.current)).map(String));
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(scan);
    };
    window.addEventListener("pointermove", move);
    return () => {
      window.removeEventListener("pointermove", move);
      cancelAnimationFrame(frame);
    };
  }, [articleRef, queue]);
}
