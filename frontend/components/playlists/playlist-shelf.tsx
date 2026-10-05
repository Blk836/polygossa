"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { shelfCardLayout, shelfCardWidth } from "@/lib/card-layout";
import { withLanguage } from "@/lib/media";
import type { PlaylistSummary } from "@/lib/playlist-types";
import { useCardLayout } from "../card-layout-context";
import { PlaylistCard } from "./playlist-card";

const SOURCES = {
  mine: { path: "playlists", title: "Your playlists", blurb: "Texts and videos you grouped to read in order." },
  shared: { path: "playlists/shared", title: "Playlists", blurb: "Collections other learners put together and shared." },
  saved: { path: "playlists/saved", title: "Saved playlists", blurb: "Playlists you saved from Explore." },
} as const;

/**
 * A sideways-scrolling row of playlist cards (yours, shared ones, or ones you saved) in the top bar's language, sized
 * like the text cards around it. Hidden while loading and when there are none. Shared and saved ones have Save.
 */
export function PlaylistShelf({ source, language }: { source: keyof typeof SOURCES; language: string }) {
  const { layout } = useCardLayout();
  const [lists, setLists] = useState<PlaylistSummary[]>([]);
  const { path, title, blurb } = SOURCES[source];

  useEffect(() => {
    let cancelled = false;
    api<PlaylistSummary[]>(withLanguage(path, language))
      .then((l) => !cancelled && setLists(l.filter((p) => p.itemCount > 0)))
      .catch(() => {}); // the shelf is extra: the page works without it
    return () => {
      cancelled = true;
    };
  }, [path, language]);

  if (lists.length === 0) return null;
  const id = `playlist-shelf-${source}`;
  return (
    <section aria-labelledby={id} className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id={id} className="font-display text-xl font-semibold tracking-tight">{title}</h2>
          <p className="text-sm text-muted">{blurb}</p>
        </div>
        <Link href="/playlists" className="shrink-0 text-sm font-medium text-accent hover:underline">All playlists →</Link>
      </div>
      <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
        {lists.map((p) => (
          <PlaylistCard key={p.id} playlist={p} layout={shelfCardLayout(layout)} saveable={source !== "mine"} className={`${shelfCardWidth(layout)} shrink-0 snap-start`} />
        ))}
      </div>
    </section>
  );
}
