"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PlaylistSummary } from "@/lib/playlist-types";
import { BookmarkIcon } from "../icons";

export function SavePlaylistButton({ playlist, className = "" }: { playlist: PlaylistSummary; className?: string }) {
  const [saved, setSaved] = useState(playlist.bookmarked);

  async function toggle() {
    const was = saved;
    setSaved(!was);
    try {
      await api(`playlists/${playlist.id}/bookmark`, { method: was ? "DELETE" : "PUT" });
    } catch {
      setSaved(was);
    }
  }

  return (
    <button
      type="button" onClick={() => void toggle()} aria-pressed={saved}
      className={`relative z-10 flex items-center gap-1 rounded-md px-2 py-1 text-xs ${saved ? "text-accent" : "text-muted hover:text-ink"} ${className}`}
    >
      <BookmarkIcon filled={saved} className="size-4" /> {saved ? "Saved" : "Save"}
    </button>
  );
}
