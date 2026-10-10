"use client";

import type { ReactNode } from "react";
import { shelfCardLayout, shelfCardWidth } from "@/lib/card-layout";
import { categoryInfo } from "@/lib/categories";
import type { Shelf, TextSummary } from "@/lib/types";
import { useCardLayout } from "../card-layout-context";
import { TextCard } from "../text-card";

export function ShelfRow({ shelf, onSeeAll, actions }: {
  shelf: Shelf;
  onSeeAll: () => void;
  actions: (t: TextSummary) => ReactNode;
}) {
  const info = categoryInfo(shelf.category);
  const { layout } = useCardLayout();
  return (
    <section aria-labelledby={`shelf-${shelf.category}`} className="mb-9">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id={`shelf-${shelf.category}`} className="font-display text-xl font-semibold tracking-tight">{info?.label}</h2>
          <p className="text-sm text-muted">{info?.blurb}</p>
        </div>
        <button type="button" onClick={onSeeAll} className="shrink-0 text-sm font-medium text-accent hover:underline">
          See all {shelf.total} →
        </button>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {shelf.items.map((t) => (
          <TextCard key={t.id} text={t} layout={shelfCardLayout(layout)} showOwner actions={actions(t)} className={`${shelfCardWidth(layout)} shrink-0 snap-start`} />
        ))}
      </div>
    </section>
  );
}
