"use client";

import { categoryLabel } from "@/lib/categories";
import type { Category } from "@/lib/types";

export function CategoryChips({ options, value, onChange, counts }: {
  options: Category[];
  value: Category | null;
  onChange: (category: Category | null) => void;
  counts?: Partial<Record<Category, number>>;
}) {
  const chip = (active: boolean) =>
    `shrink-0 rounded-full border px-3.5 py-1.5 text-sm transition ${
      active ? "border-accent bg-accent text-accent-ink" : "border-line bg-card text-ink hover:border-accent/50"
    }`;
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Category">
      <button type="button" className={chip(value === null)} aria-pressed={value === null} onClick={() => onChange(null)}>
        All
      </button>
      {options.map((c) => (
        <button key={c} type="button" className={chip(value === c)} aria-pressed={value === c} onClick={() => onChange(c)}>
          {categoryLabel(c)}
          {counts?.[c] !== undefined && <span className="ml-1.5 opacity-60">{counts[c]}</span>}
        </button>
      ))}
    </div>
  );
}
