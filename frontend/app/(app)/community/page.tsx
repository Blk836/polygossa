"use client";

import { useState, type ReactNode } from "react";
import { CardLayoutPicker } from "@/components/card-layout-picker";
import { useCardLayout } from "@/components/card-layout-context";
import { KindFilterTabs } from "@/components/kind-filter";
import { CategoryChips } from "@/components/library/category-chips";
import { MarkFinished } from "@/components/library/mark-finished";
import { ReactionButtons } from "@/components/library/reaction-buttons";
import { RecommendedShelfRow } from "@/components/library/recommended-shelf";
import { ShelfRow } from "@/components/library/shelf";
import { useRecommendations } from "@/components/library/use-recommendations";
import { useMe } from "@/components/me-context";
import { AddToPlaylist } from "@/components/playlists/add-to-playlist";
import { PlaylistShelf, PlaylistShelfRow, useShelfPlaylists } from "@/components/playlists/playlist-shelf";
import { TextCard } from "@/components/text-card";
import { useRemembered } from "@/components/use-remembered";
import { CardsLoading, ExploreShelvesLoading } from "@/components/skeletons/card-pages";
import { Empty, ErrorNote, PageHeader, Pager, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { cardGridClass } from "@/lib/card-layout";
import { CATEGORIES, exploreQuery, gridHeading, type ExploreFilters } from "@/lib/categories";
import { CEFR_LEVELS, languageName } from "@/lib/languages";
import { toggleReaction, type Reaction } from "@/lib/media";
import type { RecommendedShelf } from "@/lib/recommendations";
import type { Shelf, TextSummary } from "@/lib/types";

const PAGE_SIZE = 24;
const ALL_CATEGORIES = CATEGORIES.map((c) => c.code);

type Grid = { items: TextSummary[]; total: number };

export default function ExplorePage() {
  const { me } = useMe();
  return <Explore key={me.targetLanguage ?? "all"} language={me.targetLanguage ?? ""} />;
}

function useExploreData(f: ExploreFilters) {
  const showShelves = f.category === null && f.query === "" && !f.topic;
  const shelvesPath = exploreQuery(f, PAGE_SIZE, true);
  const shelves = useRemembered(shelvesPath, () => api<Shelf[]>(shelvesPath));
  const gridPath = showShelves ? null : exploreQuery(f, PAGE_SIZE);
  const grid = useRemembered(gridPath, () => api<Grid>(gridPath!));
  return { showShelves, shelves: shelves.data, setShelves: shelves.setData, grid: grid.data, setGrid: grid.setData, error: shelves.error ?? grid.error };
}

function Explore({ language }: { language: string }) {
  const [f, setF] = useState<ExploreFilters>({ language, category: null, level: "", kind: "all", sort: "new", query: "", page: 0, topic: null });
  const [failure, setError] = useState<string | null>(null);
  const recs = useRecommendations(language, { kind: f.kind, level: f.level }, setError);

  const set = (patch: Partial<ExploreFilters>) => setF((prev) => ({ ...prev, page: 0, ...patch }));
  const { showShelves, shelves, setShelves, grid, setGrid, error: loadError } = useExploreData(f);
  const error = failure ?? loadError;

  function update(apply: (x: TextSummary) => TextSummary) {
    setShelves((s) => s?.map((shelf) => ({ ...shelf, items: shelf.items.map(apply) })) ?? null);
    setGrid((g) => g && { ...g, items: g.items.map(apply) });
    recs.mapTexts(apply);
  }

  async function toggle(t: TextSummary, reaction: Reaction) {
    const on = reaction === "like" ? t.liked : t.bookmarked;
    update((x) => (x.id === t.id ? toggleReaction(x, reaction) : x));
    try {
      await api(`library/${t.id}/${reaction}`, { method: on ? "DELETE" : "PUT" });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const counts = Object.fromEntries((shelves ?? []).map((s) => [s.category, s.total]));
  const options = shelves ? ALL_CATEGORIES.filter((c) => counts[c] !== undefined || c === f.category) : [];
  const finished = (t: TextSummary) => update((x) => (x.id === t.id ? { ...x, progress: t.progress, stats: t.stats } : x));
  const actions = (t: TextSummary) => (
    <><ReactionButtons text={t} onToggle={(r) => void toggle(t, r)} /><AddToPlaylist text={t} /><MarkFinished text={t} onDone={finished} /></>
  );

  return (
    <div>
      <PageHeader
        title="Explore"
        subtitle={`${language ? languageName(language) + " texts" : "Texts"} and videos shared by other learners, with how much you already know.`}
        actions={<CardLayoutPicker />}
      />
      <Toolbar f={f} set={set} />
      <div className="mb-7"><CategoryChips options={options} value={f.category} counts={counts} onChange={(category) => set({ category, topic: null })} /></div>

      <ErrorNote message={error} />
      {f.query && <PlaylistShelf source="shared" language={language} query={f.query} />}
      {showShelves ? (
        <ShelvesArea f={f} recs={recs} shelves={shelves} actions={actions} set={set} />
      ) : (
        <GridView f={f} grid={grid} error={error} actions={actions} set={set} onPage={(page) => setF((prev) => ({ ...prev, page }))} />
      )}
    </div>
  );
}

function Toolbar({ f, set }: { f: ExploreFilters; set: (patch: Partial<ExploreFilters>) => void }) {
  const [q, setQ] = useState(f.query);
  return (
    <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center" data-tour="explore-search">
      <form className="flex-1" onSubmit={(e) => { e.preventDefault(); set({ query: q.trim(), topic: null }); }}>
        <input className={inputClass} type="search" placeholder="Search titles…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search titles" />
      </form>
      <div className="flex gap-2">
        <select className={`${selectClass} w-auto`} value={f.level} onChange={(e) => set({ level: e.target.value })} aria-label="Level">
          <option value="">Any level</option>
          {CEFR_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
        <KindFilterTabs value={f.kind} onChange={(kind) => set({ kind })} />
      </div>
    </div>
  );
}

function GridView({ f, grid, error, actions, set, onPage }: {
  f: ExploreFilters;
  grid: Grid | null;
  error: string | null;
  actions: (t: TextSummary) => ReactNode;
  set: (patch: Partial<ExploreFilters>) => void;
  onPage: (page: number) => void;
}) {
  const heading = gridHeading(f.query, f.category, grid?.total ?? null, f.topic);
  const { layout } = useCardLayout();
  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-tight">{heading.title}</h2>
          <p className="text-sm text-muted">{heading.subtitle}</p>
        </div>
        <select className={`${selectClass} w-auto`} value={f.sort} onChange={(e) => set({ sort: e.target.value as ExploreFilters["sort"] })} aria-label="Sort">
          <option value="new">Newest</option>
          <option value="popular">Most liked</option>
        </select>
      </div>
      {!grid && !error && <CardsLoading label="results" />}
      {grid && grid.items.length === 0 && <Empty title="Nothing matches" prop={f.kind === "video" ? "headphones" : undefined}>Try another level, type or search.</Empty>}
      <div className={cardGridClass(layout)} data-testid="card-grid">
        {grid?.items.map((t) => <TextCard key={t.id} text={t} layout={layout} showOwner actions={actions(t)} />)}
      </div>
      <Pager page={f.page} pages={grid ? Math.ceil(grid.total / PAGE_SIZE) : 0} onPage={onPage} />
    </>
  );
}

function ShelvesArea({ f, recs, shelves, actions, set }: {
  f: ExploreFilters;
  recs: ReturnType<typeof useRecommendations>;
  shelves: Shelf[] | null;
  actions: (t: TextSummary) => ReactNode;
  set: (patch: Partial<ExploreFilters>) => void;
}) {
  const playlists = useShelfPlaylists("shared", f.language);
  if (!shelves || !recs.shelves || !playlists.ready) return <ExploreShelvesLoading />;
  return (
    <>
      <RecommendedShelves
        shelves={recs.shelves}
        actions={actions}
        onOpen={recs.open}
        onNotInterested={(t) => void recs.notInterested(t)}
        onSeeAll={(s) => set(s.topic ? { topic: s.topic } : { category: s.category ?? null })}
      />
      <PlaylistShelfRow source="shared" lists={playlists.lists} />
      <ShelvesView f={f} shelves={shelves} actions={actions} onSeeAll={(category) => set({ category })} />
    </>
  );
}

function ShelvesView({ f, shelves, actions, onSeeAll }: {
  f: ExploreFilters;
  shelves: Shelf[];
  actions: (t: TextSummary) => ReactNode;
  onSeeAll: (category: Shelf["category"]) => void;
}) {
  if (shelves.length === 0 && (f.level || f.kind !== "all")) {
    return <Empty title="Nothing matches" prop={f.kind === "video" ? "headphones" : undefined}>Try another level, type or search.</Empty>;
  }
  if (shelves.length === 0) {
    return <Empty title="Nothing shared in this language yet">Share one of your own texts or videos from your library to get things started.</Empty>;
  }
  return <>{shelves.map((s) => <ShelfRow key={s.category} shelf={s} actions={actions} onSeeAll={() => onSeeAll(s.category)} />)}</>;
}

function RecommendedShelves({ shelves, actions, onOpen, onNotInterested, onSeeAll }: {
  shelves: RecommendedShelf[] | null;
  actions: (t: TextSummary) => ReactNode;
  onOpen: (shelf: RecommendedShelf["id"], t: TextSummary, position: number) => void;
  onNotInterested: (t: TextSummary) => void;
  onSeeAll: (shelf: RecommendedShelf) => void;
}) {
  return (
    <>
      {shelves?.map((s) => (
        <RecommendedShelfRow
          key={s.id}
          shelf={s}
          actions={actions}
          onOpen={(t, position) => onOpen(s.id, t, position)}
          onNotInterested={onNotInterested}
          onSeeAll={s.id === "topic" ? () => onSeeAll(s) : undefined}
        />
      ))}
    </>
  );
}
