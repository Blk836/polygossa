"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import type { Page, VocabularyEntry } from "@/lib/types";
import { Empty, ErrorNote, Pager, Spinner } from "../ui";
import { EntryRow } from "./entry-row";
import { pageCount, searchParams, type Filters } from "./search";

/** The filtered, paged list of words and phrases. */
export function WordList({ filters, onPage, onChanged }: {
  filters: Filters;
  onPage: (page: number) => void;
  /** Called after an edit or delete (plan usage may have changed). */
  onChanged: () => void;
}) {
  const [data, setData] = useState<Page<VocabularyEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Page<VocabularyEntry>>(`vocabulary?${searchParams(filters)}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [filters]);

  function replace(updated: VocabularyEntry) {
    setData((d) => d && { ...d, items: d.items.map((x) => (x.id === updated.id ? updated : x)) });
    onChanged();
  }

  async function remove(id: number) {
    await api(`vocabulary/${id}`, { method: "DELETE" });
    setData((d) => d && { ...d, total: d.total - 1, items: d.items.filter((x) => x.id !== id) });
    onChanged();
  }

  if (error) return <ErrorNote message={error} />;
  if (!data) return <Spinner />;
  const where = filters.language ? ` in ${languageName(filters.language)}` : "";
  return (
    <>
      <p className="mb-3 text-sm text-muted">
        {data.total.toLocaleString()} {data.total === 1 ? "entry" : "entries"}{where}
      </p>
      {data.items.length === 0 && <Empty title="No words here yet">Words you click while reading appear here.</Empty>}
      <ul className="space-y-3">
        {data.items.map((entry) => (
          <EntryRow key={entry.id} entry={entry} onChange={replace} onDelete={() => remove(entry.id)} />
        ))}
      </ul>
      <Pager page={filters.page} pages={pageCount(data.total)} onPage={onPage} />
    </>
  );
}
