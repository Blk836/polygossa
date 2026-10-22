"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ANKI_SYNCED_EVENT } from "@/components/anki-auto-sync";
import { useMe } from "@/components/me-context";
import { AnkiBar } from "@/components/vocabulary/anki-bar";
import { PageHeader, Spinner, selectClass } from "@/components/ui";
import { FilterBar } from "@/components/vocabulary/filters";
import { EXPORT_TOPS, exportParams, initialStatus, sortForKind, type Filters } from "@/components/vocabulary/search";
import { WordImports } from "@/components/vocabulary/word-import";
import { WordList } from "@/components/vocabulary/word-list";
import type { PlanInfo } from "@/lib/types";

const SECTIONS = [{ kind: "word", label: "Words" }, { kind: "phrase", label: "Phrases" }] as const;

function usageLine(plan: PlanInfo): string {
  const limit = plan.limits.savedWords;
  if (limit === null) return `${plan.usage.savedWords} words in learning`;
  return `${plan.usage.savedWords} of ${limit} saved words on the free plan (known words are unlimited)`;
}

const linkClass = "rounded-lg border border-line bg-card px-3 py-2 text-sm hover:bg-paper";

export default function VocabularyPage() {
  const { me } = useMe();
  return (
    <Suspense fallback={<Spinner />}>
      <VocabularyView key={me.targetLanguage ?? "all"} />
    </Suspense>
  );
}

function VocabularyView() {
  const { me, refresh } = useMe();
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    language: me.targetLanguage ?? "",
    status: initialStatus(params.get("status")),
    kind: "word",
    sort: "recent",
    query: "",
    tag: "",
    page: 0,
  }));
  const update = useCallback((patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), []);
  const [top, setTop] = useState(0);
  const exportQuery = exportParams(filters, top);
  const [importOpen, setImportOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const imported = useCallback(() => {
    setReload((r) => r + 1);
    void refresh();
  }, [refresh]);
  useEffect(() => {
    window.addEventListener(ANKI_SYNCED_EVENT, imported);
    return () => window.removeEventListener(ANKI_SYNCED_EVENT, imported);
  }, [imported]);

  return (
    <div>
      <PageHeader
        title="Vocabulary"
        subtitle={usageLine(me.plan)}
        actions={
          <>
            <button type="button" className={linkClass} data-tour="words-import" aria-expanded={importOpen} onClick={() => setImportOpen((o) => !o)}>Import words</button>
            {filters.sort === "met" && (
              <select className={selectClass} value={top} onChange={(e) => setTop(Number(e.target.value))} aria-label="Words to export">
                <option value={0}>Export all</option>
                {EXPORT_TOPS.map((n) => <option key={n} value={n}>Export top {n}</option>)}
              </select>
            )}
            <a className={linkClass} href={`/api/vocabulary/export.csv?${exportQuery}`}>Export CSV</a>
            <a className={linkClass} href={`/api/vocabulary/export.apkg?${exportQuery}`}>Export to Anki</a>
          </>
        }
      />
      <WordImports open={importOpen} defaultLanguage={me.targetLanguage ?? ""} onImported={imported} />
      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-card p-1 text-sm sm:w-fit" role="group" aria-label="Vocabulary section">
        {SECTIONS.map(({ kind, label }) => (
          <button key={kind} type="button" aria-pressed={filters.kind === kind} onClick={() => update({ kind, page: 0, sort: sortForKind(filters.sort, kind) })}
            className={`flex-1 whitespace-nowrap rounded-md px-4 py-1.5 ${filters.kind === kind ? "bg-accent-soft font-medium" : "text-muted"}`}>
            {label}
          </button>
        ))}
      </div>
      <div data-tour="words-filters"><FilterBar filters={filters} onChange={update} /></div>
      <AnkiBar />
      <WordList key={reload} filters={filters} onPage={(page) => update({ page })} onTag={(tag) => update({ tag, page: 0 })} onChanged={() => void refresh()} />
    </div>
  );
}
