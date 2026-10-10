"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { CloseIcon } from "./icons";
import { useMe } from "./me-context";
import { Button } from "./ui";
import { api } from "@/lib/api";
import { pendingTour, placeCard, sameRect, stepLabel, visibleRect, withSeen, type Rect, type Tour } from "@/lib/tours";
import type { Me } from "@/lib/types";

const WAIT_TICKS = 8;
const TICK_MS = 150;

export function FeatureTour() {
  const pathname = usePathname();
  const { me, isPro } = useMe();
  const tour = pendingTour(pathname, me.tours, { pro: isPro, language: me.targetLanguage !== null });
  return tour ? <TourCard key={tour.key} tour={tour} /> : null;
}

function findTarget(name: string | undefined): HTMLElement | null {
  if (!name) return null;
  const all = Array.from(document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`));
  return all.find((el) => visibleRect(el.getBoundingClientRect()) !== null) ?? null;
}

function locate(name: string | undefined): { el: HTMLElement | null; rect: Rect | null } {
  const el = findTarget(name);
  if (!el) return { el: null, rect: null };
  const { top, left, width, height } = el.getBoundingClientRect();
  return { el, rect: visibleRect({ top, left, width, height }) };
}

function reveal(el: HTMLElement, r: Rect) {
  if (r.top + r.height < 0 || r.top > window.innerHeight) el.scrollIntoView({ block: "center" });
}

interface Layout {
  rect: Rect | null;
  top: number;
  left: number;
}

function nextLayout(prev: Layout | null, rect: Rect | null, card: HTMLDivElement | null): Layout {
  const size = { width: card?.offsetWidth ?? 320, height: card?.offsetHeight ?? 160 };
  const pos = placeCard(rect, size, { width: window.innerWidth, height: window.innerHeight });
  const same = prev !== null && sameRect(prev.rect, rect) && prev.top === pos.top && prev.left === pos.left;
  return same ? prev : { rect, ...pos };
}

function useCardLayout(target: string | undefined, card: RefObject<HTMLDivElement | null>): Layout | null {
  const [layout, setLayout] = useState<Layout | null>(null);
  useEffect(() => {
    let ticks = 0;
    let scrolled = false;
    const tick = () => {
      const { el, rect } = locate(target);
      if (target && !rect && ticks++ < WAIT_TICKS) return;
      if (el && rect && !scrolled) {
        scrolled = true;
        reveal(el, rect);
      }
      setLayout((prev) => nextLayout(prev, rect, card.current));
    };
    const frame = requestAnimationFrame(tick);
    const timer = setInterval(tick, TICK_MS);
    window.addEventListener("scroll", tick, { capture: true, passive: true });
    window.addEventListener("resize", tick);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("scroll", tick, { capture: true });
      window.removeEventListener("resize", tick);
    };
  }, [target, card]);
  return layout;
}

function useTourActions(tour: Tour) {
  const { me, setMe } = useMe();
  const save = (local: Me, request: Promise<Me>) => {
    setMe(local);
    request.then(setMe).catch(() => undefined);
  };
  return {
    seen: () => save({ ...me, tours: withSeen(me.tours, tour.key) }, api<Me>(`me/tours/${tour.key}/seen`, { method: "POST" })),
    skipAll: () => save({ ...me, tours: { ...me.tours, on: false } }, api<Me>("me", { method: "PATCH", body: { tours: false } })),
  };
}

function TourCard({ tour }: { tour: Tour }) {
  const [index, setIndex] = useState(0);
  return <Tip key={index} tour={tour} index={index} onNext={() => setIndex(index + 1)} />;
}

function Tip({ tour, index, onNext }: { tour: Tour; index: number; onNext: () => void }) {
  const card = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const step = tour.steps[index];
  const layout = useCardLayout(step.target, card);
  const { seen, skipAll } = useTourActions(tour);
  const last = index === tour.steps.length - 1;

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") seen();
  };

  return (
    <>
      {layout?.rect && (
        <div
          data-testid="tour-highlight"
          aria-hidden
          className="pointer-events-none fixed z-40 rounded-lg ring-2 ring-rubric ring-offset-2 ring-offset-paper transition-all"
          style={{ top: layout.rect.top - 4, left: layout.rect.left - 4, width: layout.rect.width + 8, height: layout.rect.height + 8 }}
        />
      )}
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        data-testid="tour"
        onKeyDown={onKeyDown}
        className={`fixed z-50 w-[min(20rem,calc(100vw-24px))] rounded-xl border border-line bg-card p-4 shadow-lg ${layout ? "" : "invisible"}`}
        style={{ top: layout?.top ?? 0, left: layout?.left ?? 0 }}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={titleId} className="font-semibold">{step.title}</h2>
          <button type="button" aria-label="Close tour" onClick={seen} className="-mr-1 -mt-1 rounded p-1 text-muted hover:bg-paper hover:text-ink">
            <CloseIcon className="size-4" />
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">{step.body}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" onClick={skipAll} className="text-sm text-muted underline hover:text-ink">Skip all tours</button>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted tabular-nums">{stepLabel(index, tour.steps.length)}</span>
            <Button onClick={last ? seen : onNext}>{last ? "Done" : "Next"}</Button>
          </div>
        </div>
      </div>
    </>
  );
}
