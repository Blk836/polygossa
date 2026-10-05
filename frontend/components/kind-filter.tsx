"use client";

import { KIND_FILTERS, type KindFilter } from "@/lib/media";

/** All / Texts / Videos segmented control for library lists. */
export function KindFilterTabs({ value, onChange }: { value: KindFilter; onChange: (kind: KindFilter) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-card p-1 text-sm" role="group" aria-label="Show">
      {KIND_FILTERS.map((k) => (
        <button
          key={k.id}
          onClick={() => onChange(k.id)}
          aria-pressed={value === k.id}
          className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 ${value === k.id ? "bg-accent-soft font-medium" : "text-muted"}`}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
