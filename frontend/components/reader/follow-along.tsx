"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { markerBox, planMove, type Box, type Move } from "./follow-marker";

interface Shown {
  index: number;
  box: Box;
  /** The page it was shown on: a marker from another page never slides onto this one. */
  key: unknown;
}

const NO_BUDGETS = new Map<number, number>();

const at = (b: Box) => ({ transform: `translate(${b.left}px, ${b.top}px)`, width: `${b.width}px` });

function keyframes(move: Move, from: Box | null, to: Box | null): Keyframe[] | null {
  switch (move.kind) {
    case "slide":
      return [at(from!), at(to!)];
    case "hop":
      return [
        { ...at(from!), opacity: 1, offset: 0 },
        { ...at(from!), opacity: 0, offset: 0.5 },
        { ...at(to!), opacity: 0, offset: 0.5 },
        { ...at(to!), opacity: 1, offset: 1 },
      ];
    case "show":
      return [{ ...at(to!), opacity: 0 }, { ...at(to!), opacity: 1 }];
    case "hide":
      return move.ms > 0 ? [{ ...at(from!), opacity: 1 }, { ...at(from!), opacity: 0 }] : null;
    default:
      return null;
  }
}

/** Sets where the marker rests after `move`, and animates the way there. */
function apply(el: HTMLDivElement, move: Move, from: Box | null, to: Box | null) {
  if (move.kind === "none") return;
  for (const a of el.getAnimations()) a.cancel();
  const rest = to ?? from;
  if (rest) Object.assign(el.style, at(rest));
  el.style.opacity = to ? "1" : "0";
  el.dataset.move = move.kind;
  const frames = keyframes(move, from, to);
  if (frames && "ms" in move) el.animate(frames, { duration: move.ms, easing: "ease-out" });
}

function moveInput(prev: Shown | null, active: number | null, to: Box | null, nextOf: (i: number) => number | null, budgets: Map<number, number>) {
  return {
    from: prev?.box ?? null,
    to,
    adjacent: prev !== null && active !== null && nextOf(prev.index) === active,
    budgetMs: active === null ? Infinity : (budgets.get(active) ?? Infinity),
    reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
  };
}

/**
 * The bar under the spoken word (docs/acceptance/follow-along-marker.feature): slides along a line, hops across line
 * breaks and jumps, fades where speech starts and stops, and keeps to its word when the text reflows. Rendered inside
 * the positioned box that holds the words, each with its index in `data-i`.
 */
export function FollowMarker({ enabled = true, containerRef, active, nextOf, budgets = NO_BUDGETS, page }: {
  /** Off: nothing is drawn (Follow along: Sentence, or no player). */
  enabled?: boolean;
  containerRef: RefObject<HTMLElement | null>;
  /** The spoken word's index. */
  active: number | null;
  /** The word after a word: the next word slides, any other hops. Stable (memoized). */
  nextOf: (index: number) => number | null;
  /** Index → time until the next word starts (slideBudgets); without one a move takes its full time. */
  budgets?: Map<number, number>;
  /** The page shown: a marker never slides from one page onto another. */
  page?: unknown;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const shown = useRef<Shown | null>(null);

  const boxOf = useCallback(
    (index: number | null): Box | null => {
      const container = containerRef.current;
      const word = index === null ? null : container?.querySelector(`[data-i="${index}"]`);
      return container && word ? markerBox(word.getBoundingClientRect(), container.getBoundingClientRect()) : null;
    },
    [containerRef],
  );

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      shown.current = null;
      return;
    }
    const prev = shown.current?.key === page ? shown.current : null;
    const to = active === null ? null : boxOf(active);
    apply(el, planMove(moveInput(prev, active, to, nextOf, budgets)), prev?.box ?? null, to);
    shown.current = to && active !== null ? { index: active, box: to, key: page } : null;
  }, [enabled, active, page, nextOf, budgets, boxOf]);

  // Text size or window changes rewrap the lines: put the marker back under its word at once.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => {
      const s = shown.current;
      const box = s && boxOf(s.index);
      if (!s || !box || !ref.current) return;
      s.box = box;
      apply(ref.current, { kind: "place" }, null, box);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef, boxOf]);

  if (!enabled) return null;
  return (
    <div
      ref={ref}
      aria-hidden
      data-testid="follow-marker"
      className="pointer-events-none absolute left-0 top-0 h-[3px] rounded-full bg-[var(--w-marker)] opacity-0"
    />
  );
}
