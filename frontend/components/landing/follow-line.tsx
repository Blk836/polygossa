"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { FollowMarker } from "../reader/follow-along";

/**
 * A demo line that follows along like the reader: its words (spans with `data-i` 0…count-1) get the reader's
 * follow-along marker under word `active`, when there is one.
 */
export function FollowLine({ active, count, children }: { active?: number; count: number; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const nextOf = useCallback((i: number) => (i + 1 < count ? i + 1 : null), [count]);
  return (
    <div ref={ref} className="relative">
      {children}
      {active !== undefined && <FollowMarker containerRef={ref} active={active} nextOf={nextOf} />}
    </div>
  );
}
