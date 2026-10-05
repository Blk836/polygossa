"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import type { Token } from "@/lib/types";
import { fitPages, splitPages, wordBreaks, type WordBox } from "./reader-fit";
import { PAGE_WORDS, SINGLE_PAGE_MAX_WORDS, type ReaderPage } from "./reader-pages";

/** Room the finish panel takes below the last page, until it has been measured. */
const FINISH_ESTIMATE = 96;
/** Pages never get shorter than this many lines, even if they then scroll (a tiny window; a phone with the video). */
const MIN_LINES = 3;
/** Rounding slack, in px. */
const SLACK = 4;

const px = (value: string) => parseFloat(value) || 0;

/** Every word's line box in the hidden copy of the whole text (see TextMeasure). */
function wordBoxes(measure: HTMLElement, breaks: ReturnType<typeof wordBreaks>): WordBox[] {
  const origin = measure.getBoundingClientRect().top;
  const lineHeight = px(getComputedStyle(measure).lineHeight);
  const rects = new Map<number, DOMRect>();
  for (const span of measure.querySelectorAll<HTMLElement>("[data-m]")) rects.set(Number(span.dataset.m), span.getBoundingClientRect());
  return breaks.flatMap((b) => {
    const r = rects.get(b.index);
    if (!r) return [];
    const leading = Math.max(0, (lineHeight - r.height) / 2); // a span covers the glyphs, its line box the leading too
    return [{ ...b, top: r.top - origin - leading, bottom: r.bottom - origin + leading }];
  });
}

/**
 * Room for the text: the window height less everything above the text (nav, header, video on phones) and below it
 * (pager, page padding, the fixed player bar). The finish panel only shows on the last page, so it is left out here
 * and returned separately (null when it isn't the "Finish lesson" prompt).
 */
function room(text: HTMLElement): { height: number; finish: number | null } {
  const column = text.parentElement!;
  const layout = column.parentElement!;
  const main = layout.parentElement!;
  const finish = column.querySelector<HTMLElement>("[data-finish]");
  const finishHeight = finish ? finish.getBoundingClientRect().height + px(getComputedStyle(finish).marginTop) : 0;
  const end = column.lastElementChild!.getBoundingClientRect().bottom;
  const padding = px(getComputedStyle(layout).paddingBottom) + px(getComputedStyle(main).paddingBottom);
  const bar = document.querySelector("[data-bottom-bar]")?.getBoundingClientRect().height ?? 0;
  const box = text.getBoundingClientRect();
  const above = box.top + window.scrollY;
  const below = end - box.bottom - finishHeight + Math.max(padding, bar);
  return { height: window.innerHeight - above - below - SLACK, finish: finish?.dataset.finish === "prompt" ? finishHeight : null };
}

const noSubscribe = () => () => {};

/** False on the server and while hydrating, then true: the hidden copy is only rendered in the browser. */
export function useMeasuring(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

const same = (a: number[] | null, b: number[]) => a !== null && a.length === b.length && a.every((x, k) => x === b[k]);

/**
 * Pages cut to fit the screen, measured in the browser and redone when the window, the text size or the text
 * changes. Null until measured (the server renders word-count pages instead). `measuring` says the hidden copy
 * behind `measureRef` is rendered.
 */
export function useFitPages(
  paragraphs: Token[][],
  measureRef: RefObject<HTMLDivElement | null>,
  textRef: RefObject<HTMLDivElement | null>,
  measuring: boolean,
): ReaderPage[] | null {
  const [starts, setStarts] = useState<number[] | null>(null);
  const finish = useRef(FINISH_ESTIMATE);
  const breaks = useMemo(() => wordBreaks(paragraphs), [paragraphs]);

  useEffect(() => {
    const measure = measureRef.current;
    const text = textRef.current;
    if (!measure || !text) return;
    const fit = () => {
      // Leaving the reader detaches it before this effect is cleaned up, and the observer reports the detached
      // layout shrinking to nothing: there is nothing to measure then.
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
    // Size changes of the hidden copy (width, text size, fonts loading) and of the layout (page turns, the player
    // bar opening) both refit; a refit that changes nothing doesn't re-render. Observers stay silent in a background
    // tab, so the first fit also runs from a timer.
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
  }, [breaks, measureRef, textRef, measuring]);

  return useMemo(() => (starts ? splitPages(paragraphs, starts) : null), [paragraphs, starts]);
}
