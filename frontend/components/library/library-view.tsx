"use client";

import { useEffect, useState } from "react";
import { CardLayoutPicker } from "../card-layout-picker";
import { useCardLayout } from "../card-layout-context";
import { useMe } from "../me-context";
import { AddToPlaylist } from "../playlists/add-to-playlist";
import { PlaylistShelf } from "../playlists/playlist-shelf";
import { TextCard } from "../text-card";
import { Button, Empty, ErrorNote, LinkButton, PageHeader, Spinner } from "../ui";
import { FilterBar } from "./filter-bar";
import { OwnerActions } from "./owner-actions";
import { api, errorMessage } from "@/lib/api";
import { cardGridClass } from "@/lib/card-layout";
import { categoriesIn } from "@/lib/categories";
import { languageName } from "@/lib/languages";
import { emptyTitle, hasFilters, NO_FILTERS, type LibraryFilters, type LibraryView as View } from "@/lib/library-filters";
import { withKind, withLanguage } from "@/lib/media";
import type { TextSummary } from "@/lib/types";

function subtitle(view: View, used: number, limit: number | null, language: string): string {
  if (view === "saved") return "Texts, videos and playlists you saved from Explore";
  if (limit !== null) return `${used} of ${limit} texts and videos on the free plan (all languages)`;
  return language ? `Your ${languageName(language)} texts and videos` : "Your texts and videos";
}

/** Import starts in the current language. */
function importHref(language: string): string {
  return language ? `/import?language=${language}` : "/import";
}

function EmptyLibrary({ view, filters, language, onClear }: { view: View; filters: LibraryFilters; language: string; onClear: () => void }) {
  const title = emptyTitle(view, filters, language);
  if (hasFilters(filters)) {
    return <Empty title={title}><Button variant="secondary" className="mt-2" onClick={onClear}>Clear filters</Button></Empty>;
  }
  if (view === "saved") return <Empty title={title}>Save texts and videos in Explore to keep them here.</Empty>;
  return (
    <Empty title={title}>
      <div className="flex flex-wrap justify-center gap-2 pt-2">
        <LinkButton href={importHref(language)}>Import a text or video</LinkButton>
        <LinkButton href="/community" variant="secondary">Explore shared content</LinkButton>
      </div>
    </Empty>
  );
}

/** Your own texts and videos (Mine) or bookmarks (Saved), with the filter bar right above the cards. */
export function LibraryView({ view }: { view: View }) {
  const { me } = useMe();
  // Filters restart whenever the language in the top bar changes.
  return <Library key={me.targetLanguage ?? "all"} view={view} language={me.targetLanguage ?? ""} />;
}

/** Your texts (or bookmarks) of one kind; the caller filters categories on the client. */
function useLibraryTexts(view: View, kind: LibraryFilters["kind"], language: string) {
  const [texts, setTexts] = useState<TextSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<TextSummary[]>(withLanguage(withKind(view === "mine" ? "texts" : "library/bookmarks", kind), language))
      .then((t) => !cancelled && setTexts(t))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [view, kind, language]);
  return { texts, setTexts, error, setError };
}

/** The cards the filters let through, or why there are none. */
function Results({ view, shown, filters, language, onClear, onChanged, onDeleted, onError }: {
  view: View;
  shown: TextSummary[];
  filters: LibraryFilters;
  language: string;
  onClear: () => void;
  onChanged: (t: TextSummary) => void;
  onDeleted: (t: TextSummary) => void;
  onError: (message: string) => void;
}) {
  const { layout } = useCardLayout();
  if (shown.length === 0) return <EmptyLibrary view={view} filters={filters} language={language} onClear={onClear} />;
  return (
    <div className={cardGridClass(layout)} data-testid="card-grid">
      {shown.map((t) => (
        <TextCard
          key={t.id}
          text={t}
          layout={layout}
          showOwner={!t.mine}
          actions={<><AddToPlaylist text={t} />{t.mine && <OwnerActions text={t} onChanged={onChanged} onDeleted={onDeleted} onError={onError} />}</>}
        />
      ))}
    </div>
  );
}

function Library({ view, language }: { view: View; language: string }) {
  const { me, refresh } = useMe();
  const [filters, setFilters] = useState<LibraryFilters>(NO_FILTERS);
  const { texts, setTexts, error, setError } = useLibraryTexts(view, filters.kind, language);

  const replace = (t: TextSummary) => setTexts((list) => list?.map((x) => (x.id === t.id ? { ...x, ...t } : x)) ?? null);
  const removed = (t: TextSummary) => {
    setTexts((list) => list?.filter((x) => x.id !== t.id) ?? null);
    void refresh();
  };
  const shown = texts?.filter((t) => filters.category === null || t.category === filters.category) ?? null;

  return (
    <div>
      <PageHeader
        title={view === "mine" ? "Library" : "Saved"}
        subtitle={subtitle(view, me.plan.usage.texts, me.plan.limits.texts, language)}
        actions={<><CardLayoutPicker /><LinkButton href={importHref(language)} data-tour="import">+ Import</LinkButton></>}
      />
      <PlaylistShelf source={view} language={language} />
      <FilterBar categories={texts ? categoriesIn(texts) : []} filters={filters} onChange={setFilters} count={shown?.length ?? 0} />
      <ErrorNote message={error} />
      {shown ? (
        <Results view={view} shown={shown} filters={filters} language={language} onClear={() => setFilters(NO_FILTERS)}
          onChanged={replace} onDeleted={removed} onError={setError} />
      ) : (
        !error && <Spinner />
      )}
    </div>
  );
}
