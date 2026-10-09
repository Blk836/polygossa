"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { Token } from "@/lib/types";
import { fitPages, reservedBelow, splitPages, wordBreaks, type WordBox } from "./reader-fit";
import { PAGE_WORDS, SINGLE_PAGE_MAX_WORDS, type ReaderPage } from "./reader-pages";

const FINISH_ESTIMATE = 96;
const MIN_LINES = 3;
const SLACK = 4;

const px = (value: string) => parseFloat(value) || 0;

function wordBoxes(measure: HTMLElement, breaks: ReturnType<typeof wordBreaks>): WordBox[] {
  const origin = measure.getBoundingClientRect().top;
  const lineHeight = px(getComputedStyle(measure).lineHeight);
  const rects = new Map<number, DOMRect>();
  for (const span of measure.querySelectorAll<HTMLElement>("[data-m]")) rects.set(Number(span.dataset.m), span.getBoundingClientRect());
  return breaks.flatMap((b) => {
    const r = rects.get(b.index);
    if (!r) return [];
    const leading = Math.max(0, (lineHeight - r.height) / 2);
    return [{ ...b, top: r.top - origin - leading, bottom: r.bottom - origin + leading }];
  });
}

function room(text: HTMLElement): { height: number; finish: number | null } {
  const column = text.parentElement!;
  const layout = column.parentElement!;
  const main = layout.parentElement!;
  const finish = column.querySelector<HTMLElement>("[data-finish]");
  const finishHeight = finish ? finish.getBoundingClientRect().height + px(getComputedStyle(finish).marginTop) : 0;
  const end = column.lastElementChild!.getBoundingClientRect().bottom;
  const padding = px(getComputedStyle(layout).paddingBottom) + px(getComputedStyle(main).paddingBottom);
  const box = text.getBoundingClientRect();
  const docks = [...document.querySelectorAll<HTMLElement>("[data-bottom-bar], [data-floating-player]")]
    .filter((el) => getComputedStyle(el).position === "fixed")
    .map((el) => el.getBoundingClientRect());
  const above = box.top + window.scrollY;
  const below = end - box.bottom - finishHeight + Math.max(padding, reservedBelow(window.innerHeight, box, docks));
  return { height: window.innerHeight - above - below - SLACK, finish: finish?.dataset.finish === "prompt" ? finishHeight : null };
}

const noSubscribe = () => () => {};

export function useMeasuring(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

const same = (a: number[] | null, b: number[]) => a !== null && a.length === b.length && a.every((x, k) => x === b[k]);

export function useFitPages(
  paragraphs: Token[][],
  measureRef: RefObject<HTMLDivElement | null>,
  textRef: RefObject<HTMLDivElement | null>,
  measuring: boolean,
  layout: unknown,
): ReaderPage[] | null {
  const [starts, setStarts] = useState<number[] | null>(null);
  const finish = useRef(FINISH_ESTIMATE);
  const breaks = useMemo(() => wordBreaks(paragraphs), [paragraphs]);

  useEffect(() => {
    const measure = measureRef.current;
    const text = textRef.current;
    if (!measure || !text) return;
    const fit = () => {
      if (!text.isConnected || !measure.isConnected) return;
      const space = room(text);
      if (space.finish !== null) finish.current = space.finish;
      const minHeight = MIN_LINES * px(getComputedStyle(measure).lineHeight);
      const next = fitPages(wordBoxes(measure, breaks), {
        height: Math.max(space.height, minHeight),
        maxWords: PAGE_WORDS,
        singlePageMaxWords: SINGLE_PAGE_MAX_WORDS,
        lastExtra: finish.current,
      });
      setStarts((prev) => (same(prev, next) ? prev : next));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(measure);
    observer.observe(text.parentElement!.parentElement!);
    window.addEventListener("resize", fit);
    const first = window.setTimeout(fit);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", fit);
      window.clearTimeout(first);
    };
  }, [breaks, measureRef, textRef, measuring, layout]);

  return useMemo(() => (starts ? splitPages(paragraphs, starts) : null), [paragraphs, starts]);
}
