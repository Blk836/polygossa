"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { uniqueById } from "@/lib/library-filters";
import { shelfCardLayout, shelfCardWidth } from "@/lib/card-layout";
import { withLanguage } from "@/lib/media";
import type { PlaylistSummary } from "@/lib/playlist-types";
import { useCardLayout } from "../card-layout-context";
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

/**
 * A sideways-scrolling row of playlist cards (yours, or shared ones, optionally matching a search) in the top bar's
 * language, sized like the text cards around it. Hidden while loading and when there are none.
 */
export function PlaylistShelf({ source, language, query = "" }: { source: keyof typeof SOURCES; language: string; query?: string }) {
  const { layout } = useCardLayout();
  const [lists, setLists] = useState<PlaylistSummary[]>([]);
  const { blurb } = SOURCES[source];
  const title = query ? `Playlists matching “${query}”` : SOURCES[source].title;

  useEffect(() => {
    let cancelled = false;
    loadPlaylists(source, language, query)
      .then((l) => !cancelled && setLists(l.filter((p) => p.itemCount > 0)))
      .catch(() => !cancelled && setLists([])); // the shelf is extra: the page works without it
    return () => {
      cancelled = true;
    };
  }, [source, language, query]);

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
