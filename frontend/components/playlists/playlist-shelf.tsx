"use client";

import Link from "next/link";
import { api } from "@/lib/api";
import { uniqueById } from "@/lib/library-filters";
import { shelfCardLayout, shelfCardWidth, shelfTrackClass } from "@/lib/card-layout";
import { withLanguage } from "@/lib/media";
import type { PlaylistSummary } from "@/lib/playlist-types";
import { useCardLayout } from "../card-layout-context";
import { useRemembered } from "../use-remembered";
import { PlaylistCard } from "./playlist-card";

const SOURCES = {
  yours: { title: "Your playlists", blurb: "Playlists you made or saved, to read in order." },
  shared: { title: "Playlists", blurb: "Collections other learners put together and shared." },
} as const;

export function loadPlaylists(source: keyof typeof SOURCES, language: string, query = ""): Promise<PlaylistSummary[]> {
  if (source === "yours") {
    return Promise.all([api<PlaylistSummary[]>(withLanguage("playlists", language)), api<PlaylistSummary[]>(withLanguage("playlists/saved", language))])
      .then(([made, saved]) => uniqueById(made, saved));
  }
  return api<PlaylistSummary[]>(withLanguage(query ? `playlists/shared?q=${encodeURIComponent(query)}` : "playlists/shared", language));
}

export function saveable(p: PlaylistSummary): boolean {
  return !p.mine || p.bookmarked;
}

type ShelfSource = keyof typeof SOURCES;

export function useShelfPlaylists(source: ShelfSource, language: string, query = "") {
  const { data, error } = useRemembered(`playlists:${source}:${language}:${query}`, () => loadPlaylists(source, language, query));
  return { lists: (data ?? []).filter((p) => p.itemCount > 0), ready: data !== null || error !== null };
}

export function PlaylistShelf({ source, language, query = "" }: { source: ShelfSource; language: string; query?: string }) {
  const { lists } = useShelfPlaylists(source, language, query);
  return <PlaylistShelfRow source={source} query={query} lists={lists} />;
}

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
      <div className={shelfTrackClass(layout, lists.length)}>
        {lists.map((p) => (
          <PlaylistCard key={p.id} playlist={p} layout={shelfCardLayout(layout)} saveable={source === "shared" || saveable(p)} className={`${shelfCardWidth(layout)} shrink-0 snap-start`} />
        ))}
      </div>
    </section>
  );
}
