"use client";

import { api } from "@/lib/api";
import { languageName } from "@/lib/languages";
import type { Page, VocabularyEntry } from "@/lib/types";
import { Empty, ErrorNote, Pager, Spinner } from "../ui";
import { useRemembered } from "../use-remembered";
import { EntryRow } from "./entry-row";
import { pageCount, searchParams, type Filters } from "./search";

/** The filtered, paged list of words and phrases. */
export function WordList({ filters, onPage, onTag, onChanged }: {
  filters: Filters;
  onPage: (page: number) => void;
  /** Filters the list to a tag ("" clears it). */
  onTag: (tag: string) => void;
  /** Called after an edit or delete (plan usage may have changed). */
  onChanged: () => void;
}) {
  const path = `vocabulary?${searchParams(filters)}`;
  const { data, setData, error } = useRemembered(path, () => api<Page<VocabularyEntry>>(path));

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
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted">
        {data.total.toLocaleString()} {data.total === 1 ? "entry" : "entries"}{where}
        {filters.tag && (
          <span data-testid="tag-filter" className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-ink">
            tagged {filters.tag}
            <button type="button" onClick={() => onTag("")} aria-label="Clear tag filter" className="text-muted hover:text-ink">✕</button>
          </span>
        )}
      </p>
      {data.items.length === 0 && <Empty title="No words here yet">Words you click while reading appear here.</Empty>}
      <ul className="space-y-3">
        {data.items.map((entry) => (
          <EntryRow key={entry.id} entry={entry} onChange={replace} onDelete={() => remove(entry.id)} onTag={onTag} />
        ))}
      </ul>
      <Pager page={filters.page} pages={pageCount(data.total)} onPage={onPage} />
    </>
  );
}
