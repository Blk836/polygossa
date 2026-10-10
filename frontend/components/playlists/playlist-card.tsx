"use client";

import { Named } from "@/components/avatar";
import Image from "next/image";
import { useState } from "react";
import type { CardLayout } from "@/lib/card-layout";
import { deck, itemsLabel } from "@/lib/playlists";
import type { PlaylistCover, PlaylistSummary } from "@/lib/playlist-types";
import { PlaylistIcon } from "../icons";
import { PlaylistPane } from "./playlist-pane";
import { SavePlaylistButton } from "./save-playlist";

const TITLE: Record<CardLayout, string> = {
  cards: "line-clamp-2 text-[17px]",
  compact: "line-clamp-2 text-[15px]",
  list: "line-clamp-1 text-[15px]",
};

function DeckCardFace({ cover, small }: { cover: PlaylistCover; small: boolean }) {
  if (cover.thumbnailUrl) {
    return <Image src={cover.thumbnailUrl} alt="" fill sizes={small ? "120px" : "240px"} className="object-cover" />;
  }
  return (
    <span className={`cover cover-${cover.category} absolute inset-0 flex items-center justify-center font-display font-semibold text-ink/80 select-none ${small ? "text-xl" : "text-3xl"}`}>
      {[...cover.title.trim()][0] ?? "·"}
    </span>
  );
}

function Deck({ playlist, small }: { playlist: PlaylistSummary; small: boolean }) {
  const cards = deck(playlist.covers);
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-paper">
      {cards.length === 0 && <PlaylistIcon className="size-10 text-muted" />}
      {cards.map(({ cover, rotate, shift }) => (
        <span
          key={cover.textId} data-testid="deck-card" title={cover.title}
          className="absolute aspect-[16/9] w-[64%] overflow-hidden rounded-md border-2 border-card bg-line shadow-md transition duration-300 group-hover:shadow-lg"
          style={{ transform: rotate || shift ? `translateX(${shift}%) rotate(${rotate}deg)` : "none" }}
        >
          <DeckCardFace cover={cover} small={small} />
        </span>
      ))}
    </div>
  );
}

function Tag() {
  return (
    <span className="absolute top-2 left-2 flex items-center gap-1 rounded bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-ink shadow-sm">
      <PlaylistIcon className="size-3.5" aria-hidden />Playlist
    </span>
  );
}

const FRAME: Record<CardLayout, string> = { cards: "flex flex-col", compact: "flex flex-col", list: "flex items-center gap-3 p-2" };
const COVER: Record<CardLayout, string> = { cards: "", compact: "", list: "w-28 shrink-0 rounded-lg sm:w-36" };
const BODY: Record<CardLayout, string> = { cards: "gap-1.5 p-3.5", compact: "gap-1 p-2.5", list: "gap-1" };
const SAVE: Record<CardLayout, string> = {
  cards: "mx-3.5 mb-3 flex justify-end border-t border-line pt-2",
  compact: "mx-2.5 mb-2 flex justify-end border-t border-line pt-1.5",
  list: "shrink-0",
};

export function PlaylistCard({ playlist, layout = "cards", className = "", saveable = false }: {
  playlist: PlaylistSummary;
  layout?: CardLayout;
  className?: string;
  saveable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <article
      data-testid="playlist-card"
      className={`group relative overflow-hidden rounded-xl border border-line bg-card transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md ${FRAME[layout]} ${className}`}
    >
      <div className={`relative aspect-[16/9] overflow-hidden ${COVER[layout]}`}>
        <Deck playlist={playlist} small={layout !== "cards"} />
        {layout !== "list" && <Tag />}
      </div>
      <div className={`flex min-w-0 flex-1 flex-col ${BODY[layout]}`}>
        <Meta playlist={playlist} list={layout === "list"} />
        <button
          type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" lang={playlist.language}
          className={`${TITLE[layout]} cursor-pointer text-left font-reading leading-snug font-semibold group-hover:text-accent after:absolute after:inset-0`}
        >
          {playlist.title}
        </button>
        {!playlist.mine && <p className="-mt-1 truncate text-xs text-muted">by <Named name={playlist.owner.displayName} photoUrl={playlist.owner.photoUrl} /></p>}
        {playlist.completedCount > 0 && <p className="text-xs text-muted">{itemsLabel(playlist)}</p>}
      </div>
      {saveable && <div className={SAVE[layout]}><SavePlaylistButton playlist={playlist} /></div>}
      {open && <PlaylistPane playlist={playlist} onClose={() => setOpen(false)} />}
    </article>
  );
}

function Meta({ playlist, list }: { playlist: PlaylistSummary; list: boolean }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted uppercase">
      <span className="text-rubric">{list ? "Playlist · " : ""}{itemsLabel({ itemCount: playlist.itemCount, completedCount: 0 })}</span>
      {playlist.mine && <span className="ml-auto rounded bg-accent-soft px-1.5 py-0.5 tracking-normal text-ink normal-case">{playlist.isPublic ? "Shared" : "Private"}</span>}
    </p>
  );
}
