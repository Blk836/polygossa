"use client";

import { useRef, useState, type PointerEvent } from "react";
import { ChevronRightIcon, VideoIcon } from "../icons";

const SWIPE = 80;

export function useSwipe(onSwipe: () => void) {
  const start = useRef<number | null>(null);
  const [offset, setOffset] = useState(0);
  const end = () => {
    start.current = null;
    setOffset(0);
  };
  return {
    offset,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if ((e.target as HTMLElement).closest("button")) return;
        start.current = e.clientX;
        e.currentTarget.setPointerCapture(e.pointerId);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        if (start.current !== null) setOffset(e.clientX - start.current);
      },
      onPointerUp: (e: PointerEvent<HTMLElement>) => {
        const swiped = start.current !== null && Math.abs(e.clientX - start.current) >= SWIPE;
        end();
        if (swiped) onSwipe();
      },
      onPointerCancel: end,
    },
  };
}

export function TuckHandle({ onTuck, handlers }: { onTuck: () => void; handlers: ReturnType<typeof useSwipe>["handlers"] }) {
  return (
    <div data-testid="video-handle" className="relative flex h-7 touch-pan-y items-center justify-center lg:hidden" {...handlers}>
      <span className="h-1 w-10 rounded-full bg-line" aria-hidden />
      <button
        type="button"
        onClick={onTuck}
        className="absolute right-0 flex size-7 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink"
        aria-label="Tuck video away"
        title="Tuck video away (or swipe it sideways)"
      >
        <ChevronRightIcon className="size-4" />
      </button>
    </div>
  );
}

export function ShowVideoTab({ shown, onShow }: { shown: boolean; onShow: () => void }) {
  if (!shown) return null;
  return (
    <button
      type="button"
      onClick={onShow}
      className="fixed top-1/3 right-0 z-30 flex items-center rounded-l-full border border-r-0 border-line bg-card py-2 pr-2 pl-3 text-muted shadow-lg hover:text-ink lg:hidden"
      aria-label="Show video"
      title="Show video"
    >
      <VideoIcon className="size-5" />
    </button>
  );
}
