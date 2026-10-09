"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { PlaylistSummary } from "@/lib/playlist-types";
import { BookmarkIcon } from "../icons";

/**
 * Save / Saved toggle for a playlist, like the one on texts: flips at once, and flips back if the server says no.
 * Saved playlists are listed in My library's playlists row and on the playlists page.
 */
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
