"use client";

import { useState } from "react";
import { inputClass, selectClass } from "../ui";
import type { Filters } from "./search";

/** Search box and filter selects; changing any filter returns to the first page. */
export function FilterBar({ filters, wordsTab, onChange }: {
  filters: Filters;
  wordsTab: boolean;
  onChange: (patch: Partial<Filters>) => void;
}) {
  const [q, setQ] = useState(filters.query);
  const set = (patch: Partial<Filters>) => onChange({ ...patch, page: 0 });
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
      <form onSubmit={(e) => { e.preventDefault(); set({ query: q.trim() }); }}>
        <input className={inputClass} placeholder="Search words or definitions…" value={q} onChange={(e) => setQ(e.target.value)} disabled={!wordsTab} />
      </form>
      {wordsTab && (
        <>
          <select className={selectClass} value={filters.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
            <option value="">Any status</option>
            <option value="learning">Learning</option>
            <option value="known">Known</option>
            <option value="ignored">Ignored</option>
          </select>
          <select className={selectClass} value={filters.kind} onChange={(e) => set({ kind: e.target.value })} aria-label="Type">
            <option value="">Words & phrases</option>
            <option value="word">Words</option>
            <option value="phrase">Phrases</option>
          </select>
          <select className={selectClass} value={filters.sort} onChange={(e) => onChange({ sort: e.target.value })} aria-label="Sort">
            <option value="recent">Recently updated</option>
            <option value="alpha">A–Z</option>
            <option value="due">Due for review</option>
          </select>
        </>
      )}
    </div>
  );
}
