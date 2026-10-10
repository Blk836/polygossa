"use client";

import { KIND_FILTERS, type KindFilter } from "@/lib/media";

export function SegmentedFilter<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: { id: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-card p-1 text-sm" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 ${value === o.id ? "bg-accent-soft font-medium" : "text-muted"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function KindFilterTabs({ value, onChange }: { value: KindFilter; onChange: (kind: KindFilter) => void }) {
  return <SegmentedFilter label="Show" options={KIND_FILTERS} value={value} onChange={onChange} />;
}
