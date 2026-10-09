"use client";

import { useState } from "react";
import { CardLayoutPicker } from "../card-layout-picker";
import { useCardLayout } from "../card-layout-context";
import { useMe } from "../me-context";
import { AddToPlaylist } from "../playlists/add-to-playlist";
import { PlaylistShelf } from "../playlists/playlist-shelf";
import { TextCard } from "../text-card";
import { useRemembered } from "../use-remembered";
import { CardsLoading } from "../skeletons/card-pages";
import { Button, Empty, ErrorNote, LinkButton, PageHeader } from "../ui";
import { FilterBar } from "./filter-bar";
import { OwnerActions } from "./owner-actions";
import { api, errorMessage } from "@/lib/api";
import { cardGridClass } from "@/lib/card-layout";
import { categoriesIn } from "@/lib/categories";
import {
  emptyTitle,
  hasFilters,
  librarySubtitle,
  NO_FILTERS,
  shownItems,
  uniqueById,
  type LibraryFilters,
  type SourceFilter,
} from "@/lib/library-filters";
import { withKind, withLanguage } from "@/lib/media";
import type { TextSummary } from "@/lib/types";

/** Import starts in the current language. */
function importHref(language: string): string {
  return language ? `/import?language=${language}` : "/import";
}

function EmptyLibrary({ filters, language, onClear }: { filters: LibraryFilters; language: string; onClear: () => void }) {
  const title = emptyTitle(filters, language);
  if (hasFilters(filters)) {
    return <Empty title={title}><Button variant="secondary" className="mt-2" onClick={onClear}>Clear filters</Button></Empty>;
  }
  return (
    <Empty title={title}>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <LinkButton href={importHref(language)}>Import a text or video</LinkButton>
        <LinkButton href="/community" variant="secondary">Explore shared content</LinkButton>
      </div>
    </Empty>
  );
}

/** My library: your imports and the items you saved in Explore, in one list, with the filter bar right above it. */
export function LibraryView({ source = "all" }: { source?: SourceFilter }) {
  const { me } = useMe();
  // Filters restart whenever the language in the top bar changes.
  return <Library key={me.targetLanguage ?? "all"} source={source} language={me.targetLanguage ?? ""} />;
}

/** Your imports, then your saved items (each once), of one kind; the caller filters source and category. */
function useLibraryTexts(kind: LibraryFilters["kind"], language: string) {
  const list = (path: string) => api<TextSummary[]>(withLanguage(withKind(path, kind), language));
  const { data: texts, setData: setTexts, error, setError } = useRemembered(`library:${kind}:${language}`, () =>
    Promise.all([list("texts"), list("library/bookmarks")]).then(([mine, saved]) => uniqueById(mine, saved)),
  );
  return { texts, setTexts, error, setError };
}

/** Unsave for a saved card: it leaves the list once the server agrees. */
function UnsaveButton({ text, onUnsaved, onError }: { text: TextSummary; onUnsaved: (t: TextSummary) => void; onError: (message: string) => void }) {
  async function unsave() {
    try {
      await api(`library/${text.id}/bookmark`, { method: "DELETE" });
      onUnsaved(text);
    } catch (e) {
      onError(errorMessage(e));
    }
  }
  return (
    <button type="button" onClick={() => void unsave()} className="ml-auto rounded-md px-2 py-1 text-xs text-muted hover:text-ink">
      Unsave
    </button>
  );
}

/** The cards the filters let through, or why there are none. */
function Results({ shown, filters, language, onClear, onChanged, onRemoved, onError }: {
  shown: TextSummary[];
  filters: LibraryFilters;
  language: string;
  onClear: () => void;
  onChanged: (t: TextSummary) => void;
  onRemoved: (t: TextSummary) => void;
  onError: (message: string) => void;
}) {
  const { layout } = useCardLayout();
  if (shown.length === 0) return <EmptyLibrary filters={filters} language={language} onClear={onClear} />;
  return (
    <div className={cardGridClass(layout)} data-testid="card-grid">
      {shown.map((t) => (
        <TextCard
          key={t.id}
          text={t}
          layout={layout}
          showOwner={!t.mine}
          actions={
            <>
              <AddToPlaylist text={t} />
              {t.mine ? (
                <OwnerActions text={t} onChanged={onChanged} onDeleted={onRemoved} onError={onError} />
              ) : (
                <UnsaveButton text={t} onUnsaved={onRemoved} onError={onError} />
              )}
            </>
          }
        />
      ))}
    </div>
  );
}

function Library({ source, language }: { source: SourceFilter; language: string }) {
  const { me, refresh } = useMe();
  const [filters, setFilters] = useState<LibraryFilters>({ ...NO_FILTERS, source });
  const { texts, setTexts, error, setError } = useLibraryTexts(filters.kind, language);

  const replace = (t: TextSummary) => setTexts((list) => list?.map((x) => (x.id === t.id ? { ...x, ...t } : x)) ?? null);
  const removed = (t: TextSummary) => {
    setTexts((list) => list?.filter((x) => x.id !== t.id) ?? null);
    void refresh();
  };
  const shown = texts ? shownItems(texts, filters) : null;

  return (
    <div>
      <PageHeader
        title="My library"
        subtitle={librarySubtitle(me.plan.usage.texts, me.plan.limits.texts, language)}
        actions={<><CardLayoutPicker /><LinkButton href="/playlists" variant="secondary">Playlists</LinkButton><LinkButton href={importHref(language)} data-tour="import">+ Import</LinkButton></>}
      />
      <PlaylistShelf source="yours" language={language} />
      <FilterBar categories={texts ? categoriesIn(texts) : []} filters={filters} onChange={setFilters} count={shown?.length ?? 0} />
      <ErrorNote message={error} />
      {shown ? (
        <Results shown={shown} filters={filters} language={language} onClear={() => setFilters(NO_FILTERS)}
          onChanged={replace} onRemoved={removed} onError={setError} />
      ) : (
        !error && <CardsLoading label="your library" />
      )}
    </div>
  );
}
