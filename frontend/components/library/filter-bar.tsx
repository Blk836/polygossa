"use client";

import { useCallback, useRef, useState } from "react";
import { CloseIcon } from "../icons";
import { KindFilterTabs, SegmentedFilter } from "../kind-filter";
import { Button } from "../ui";
import { useDismiss } from "../use-dismiss";
import { CategoryChips } from "./category-chips";
import { extraFilterCount, filterPills, NO_FILTERS, showLabel, SOURCE_FILTERS, type LibraryFilters } from "@/lib/library-filters";
import type { Category } from "@/lib/types";

function FiltersIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  );
}

function FiltersPanel({ filters, onChange, count, onClose }: {
  filters: LibraryFilters;
  onChange: (f: LibraryFilters) => void;
  count: number;
  onClose: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-ink/30 sm:hidden" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-label="Filters"
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-line bg-card p-5 shadow-lg sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:bottom-auto sm:mt-2 sm:w-80 sm:rounded-xl"
      >
        <h2 className="font-display text-lg font-semibold">Filters</h2>
        <p className="mt-4 mb-2 text-sm font-medium">Type</p>
        <KindFilterTabs value={filters.kind} onChange={(kind) => onChange({ ...filters, kind })} />
        <p className="mt-4 mb-2 text-sm font-medium">Source</p>
        <SegmentedFilter label="Source" options={SOURCE_FILTERS} value={filters.source} onChange={(source) => onChange({ ...filters, source })} />
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line pt-4">
          <button type="button" className="text-sm font-medium underline underline-offset-2" onClick={() => onChange(NO_FILTERS)}>
            Clear all
          </button>
          <Button type="button" onClick={onClose}>{showLabel(count)}</Button>
        </div>
      </div>
    </>
  );
}

export function FilterBar({ categories, filters, onChange, count }: {
  categories: Category[];
  filters: LibraryFilters;
  onChange: (f: LibraryFilters) => void;
  count: number;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const refocus = useCallback(() => button.current?.focus(), []);
  useDismiss(open, close, root, refocus);

  const extra = extraFilterCount(filters);

  return (
    <section aria-label="Filter library" className="mb-4 flex items-start gap-2">
      <div className="min-w-0 flex-1">
        {categories.length > 1 && <CategoryChips options={categories} value={filters.category} onChange={(category) => onChange({ ...filters, category })} />}
      </div>
      {filterPills(filters).map((pill) => (
        <button
          key={pill.label}
          type="button"
          aria-label={`Remove filter: ${pill.label}`}
          onClick={() => onChange(pill.without)}
          className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft py-1.5 pr-2 pl-3 text-sm font-medium hover:bg-accent-soft/70"
        >
          {pill.label}
          <CloseIcon className="size-3.5" />
        </button>
      ))}
      <div ref={root} className="relative shrink-0">
        <button
          ref={button}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={extra > 0 ? `Filters, ${extra} active` : "Filters"}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
            extra > 0 || open ? "border-ink" : "border-line bg-card hover:border-accent/50"
          }`}
        >
          <FiltersIcon />
          Filters
          {extra > 0 && (
            <span data-testid="filter-count" className="grid size-5 place-items-center rounded-full bg-ink text-[11px] text-paper">
              {extra}
            </span>
          )}
        </button>
        {open && <FiltersPanel filters={filters} onChange={onChange} count={count} onClose={close} />}
      </div>
    </section>
  );
}
