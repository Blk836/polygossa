"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { uniqueById } from "@/lib/library-filters";
import { shelfCardLayout, shelfCardWidth } from "@/lib/card-layout";
import { withLanguage } from "@/lib/media";
import type { PlaylistSummary } from "@/lib/playlist-types";
import { useCardLayout } from "../card-layout-context";
import { useRemembered } from "../use-remembered";
import { PlaylistCard } from "./playlist-card";

const SOURCES = {
  yours: { title: "Your playlists", blurb: "Playlists you made or saved, to read in order." },
  shared: { title: "Playlists", blurb: "Collections other learners put together and shared." },
} as const;

/** Yours: the ones you made, then the ones you saved (each once); shared: everyone's, or those matching a search. */
export function loadPlaylists(source: keyof typeof SOURCES, language: string, query = ""): Promise<PlaylistSummary[]> {
  if (source === "yours") {
    return Promise.all([api<PlaylistSummary[]>(withLanguage("playlists", language)), api<PlaylistSummary[]>(withLanguage("playlists/saved", language))])
      .then(([made, saved]) => uniqueById(made, saved));
  }
  return api<PlaylistSummary[]>(withLanguage(query ? `playlists/shared?q=${encodeURIComponent(query)}` : "playlists/shared", language));
}

/** Among yours, Save shows on playlists someone else made, and on your own that you saved (so they can be unsaved). */
export function saveable(p: PlaylistSummary): boolean {
  return !p.mine || p.bookmarked;
}

type ShelfSource = keyof typeof SOURCES;

/**
 * A playlist shelf's playlists (those with items), remembered per source, language and search. `ready` once they
 * answered or failed: the shelf is extra, so a failure just leaves it out.
 */
export function useShelfPlaylists(source: ShelfSource, language: string, query = "") {
  const { data, error } = useRemembered(`playlists:${source}:${language}:${query}`, () => loadPlaylists(source, language, query));
  return { lists: (data ?? []).filter((p) => p.itemCount > 0), ready: data !== null || error !== null };
}

/**
 * A sideways-scrolling row of playlist cards (yours, or shared ones, optionally matching a search) in the top bar's
 * language, sized like the text cards around it. Hidden while loading and when there are none.
 */
export function PlaylistShelf({ source, language, query = "" }: { source: ShelfSource; language: string; query?: string }) {
  const { lists } = useShelfPlaylists(source, language, query);
  return <PlaylistShelfRow source={source} query={query} lists={lists} />;
}

/** The shelf for playlists already loaded (see useShelfPlaylists); nothing when there are none. */
export function PlaylistShelfRow({ source, query = "", lists }: { source: ShelfSource; query?: string; lists: PlaylistSummary[] }) {
  const { layout } = useCardLayout();
  const { blurb } = SOURCES[source];
  const title = query ? `Playlists matching “${query}”` : SOURCES[source].title;
  if (lists.length === 0) return null;
  const id = `playlist-shelf-${source}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id={id} className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{blurb}</p>
        </div>
        {source === "yours" && <Link href="/playlists" className="shrink-0 text-sm font-medium text-accent hover:underline">All playlists →</Link>}
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {lists.map((p) => (
          <PlaylistCard key={p.id} playlist={p} layout={shelfCardLayout(layout)} saveable={source === "shared" || saveable(p)} className={`${shelfCardWidth(layout)} shrink-0 snap-start`} />
        ))}
      </div>
    </section>
  );
}
