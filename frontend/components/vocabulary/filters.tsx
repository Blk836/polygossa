"use client";

import { useState } from "react";
import { inputClass, selectClass } from "../ui";
import type { Filters } from "./search";

export function FilterBar({ filters, onChange }: {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const [q, setQ] = useState(filters.query);
  const set = (patch: Partial<Filters>) => onChange({ ...patch, page: 0 });
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
      <form onSubmit={(e) => { e.preventDefault(); set({ query: q.trim() }); }}>
        <input className={inputClass} placeholder="Search words or definitions…" value={q} onChange={(e) => setQ(e.target.value)} />
      </form>
      <select className={selectClass} value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
        <option value="">Any status</option>
        <option value="learning">Learning</option>
        <option value="known">Known</option>
        <option value="ignored">Ignored</option>
      </select>
      <select className={selectClass} value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })} aria-label="Sort">
        <option value="recent">Recently updated</option>
        <option value="alpha">A–Z</option>
        <option value="due">Due for review</option>
      </select>
    </div>
  );
}
