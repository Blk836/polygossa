"use client";

import { useCallback, useState } from "react";
import { useMe } from "@/components/me-context";
import { PageHeader } from "@/components/ui";
import { FilterBar } from "@/components/vocabulary/filters";
import { exportParams, type Filters } from "@/components/vocabulary/search";
import { SentenceList } from "@/components/vocabulary/sentence-list";
import { WordImports } from "@/components/vocabulary/word-import";
import { WordList } from "@/components/vocabulary/word-list";
import type { PlanInfo } from "@/lib/types";

type Tab = "words" | "sentences";

function usageLine(plan: PlanInfo): string {
  const limit = plan.limits.savedWords;
  if (limit === null) return `${plan.usage.savedWords} words in learning`;
  return `${plan.usage.savedWords} of ${limit} saved words on the free plan (known words are unlimited)`;
}

const linkClass = "rounded-lg border border-line bg-card px-3 py-2 text-sm hover:bg-paper";

/** Filters and paging start over whenever the language in the top bar changes. */
export default function VocabularyPage() {
  const { me } = useMe();
  return <VocabularyView key={me.targetLanguage ?? "all"} />;
}

function VocabularyView() {
  const { me, refresh } = useMe();
  const [tab, setTab] = useState<Tab>("words");
  const [filters, setFilters] = useState<Filters>({
    language: me.targetLanguage ?? "",
    status: "learning",
    kind: "",
    sort: "recent",
    query: "",
    tag: "",
    page: 0,
  });
  const update = useCallback((patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch })), []);
  const exportQuery = exportParams(filters);
  const [importOpen, setImportOpen] = useState(false);
  const [reload, setReload] = useState(0);
  const imported = useCallback(() => {
    setReload((r) => r + 1);
    void refresh();
  }, [refresh]);

  return (
    <div>
      <PageHeader
        title="Vocabulary"
        subtitle={usageLine(me.plan)}
        actions={
          <>
            <button type="button" className={linkClass} data-tour="words-import" aria-expanded={importOpen} onClick={() => setImportOpen((o) => !o)}>Import words</button>
            <a className={linkClass} href={`/api/vocabulary/export.csv?${exportQuery}`}>Export CSV</a>
            <a className={linkClass} href={`/api/vocabulary/export.apkg?${exportQuery}`}>Export to Anki</a>
          </>
        }
      />
      <WordImports open={importOpen} defaultLanguage={me.targetLanguage ?? ""} onImported={imported} />
      <div className="mb-4 flex gap-1 rounded-lg border border-line bg-card p-1 text-sm sm:w-fit" role="group" aria-label="Vocabulary section">
        {(["words", "sentences"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`flex-1 whitespace-nowrap rounded-md px-4 py-1.5 capitalize ${tab === t ? "bg-accent-soft font-medium" : "text-muted"}`}>
            {t}
          </button>
        ))}
      </div>
      <div data-tour="words-filters"><FilterBar filters={filters} wordsTab={tab === "words"} onChange={update} /></div>
      {tab === "sentences" ? (
        <SentenceList language={filters.language} />
      ) : (
        <WordList key={reload} filters={filters} onPage={(page) => update({ page })} onTag={(tag) => update({ tag, page: 0 })} onChanged={() => void refresh()} />
      )}
    </div>
  );
}
