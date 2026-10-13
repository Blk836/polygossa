"use client";

import type { ReactNode } from "react";
import { shelfCardLayout, shelfCardWidth, shelfTrackClass } from "@/lib/card-layout";
import { reasonLabel, shelfHeading, type RecommendedShelf } from "@/lib/recommendations";
import type { TextSummary } from "@/lib/types";
import { useCardLayout } from "../card-layout-context";
import { CloseIcon } from "../icons";
import { TextCard } from "../text-card";

export function RecommendedShelfRow({ shelf, actions, onOpen, onNotInterested, onSeeAll }: {
  shelf: RecommendedShelf;
  actions: (t: TextSummary) => ReactNode;
  onOpen: (t: TextSummary, position: number) => void;
  onNotInterested: (t: TextSummary) => void;
  onSeeAll?: () => void;
}) {
  const { title, subtitle } = shelfHeading(shelf);
  const { layout } = useCardLayout();
  const headingId = `rec-${shelf.id}`;
  return (
    <section aria-labelledby={headingId} className="mb-9">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id={headingId} className="truncate font-display text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{subtitle}</p>
        </div>
        {onSeeAll && (
          <button type="button" onClick={onSeeAll} className="shrink-0 text-sm font-medium text-accent hover:underline">
            See all →
          </button>
        )}
      </div>
      <div className={shelfTrackClass(layout, shelf.items.length)}>
        {shelf.items.map(({ text, reason }, position) => (
          <TextCard
            key={text.id}
            text={text}
            layout={shelfCardLayout(layout)}
            showOwner
            reason={reasonLabel(reason)}
            onOpen={() => onOpen(text, position)}
            className={`${shelfCardWidth(layout)} shrink-0 snap-start`}
            actions={
              <>
                {actions(text)}
                {shelf.id !== "continue" && (
                  <button
                    type="button"
                    onClick={() => onNotInterested(text)}
                    className="rounded-md p-1 text-muted hover:text-ink"
                    aria-label="Not interested"
                    title="Not interested: show me less like this"
                  >
                    <CloseIcon className="size-4" />
                  </button>
                )}
              </>
            }
          />
        ))}
      </div>
    </section>
  );
}
