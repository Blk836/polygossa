"use client";

import { Named } from "@/components/avatar";
import Link from "next/link";
import { languageName } from "@/lib/languages";
import { playlistReadHref } from "@/lib/playlists";
import type { ReaderPlaylist } from "@/lib/playlist-types";
import type { TextSummary } from "@/lib/types";
import { HeadphonesIcon, PlaylistIcon } from "../icons";
import { AddToPlaylist } from "../playlists/add-to-playlist";
import { KnownBar, LevelBadge } from "../ui";
import { SettingsMenu, ShortcutsMenu } from "./reader-menus";
import type { ReaderSettings } from "./reader-settings";
import type { ReaderStats } from "./reader-text";

export const FONT_SIZES = ["text-lg", "text-xl", "text-2xl", "text-3xl"];

interface Props {
  text: TextSummary;
  playlist: ReaderPlaylist | null;
  stats: ReaderStats;
  settings: ReaderSettings;
  onSettings: (change: Partial<ReaderSettings>) => void;
  /** Null hides the audio button (no audio and not the owner). */
  audio: { open: boolean; exists: boolean; toggle: () => void } | null;
  /** Whether playback shortcuts apply (audio or video). */
  media: boolean;
}

/** Title and details, then one bar with the known-word stats and the reader's controls (the same for every kind). */
export function ReaderHeader({ text, playlist, stats, settings, onSettings, audio, media }: Props) {
  return (
    <div className="mb-4">
      {playlist ? <PlaylistStrip playlist={playlist} /> : <Link href="/library" className="text-sm text-muted hover:text-ink">← Library</Link>}
      <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight">{text.title}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <LevelBadge level={text.cefrLevel} />
        <span>{languageName(text.language)}</span>
        <span>· {text.wordCount.toLocaleString()} words</span>
        {!text.mine && <span>· shared by <Named name={text.owner.displayName} photoUrl={text.owner.photoUrl} /></span>}
        {text.sourceUrl && <a href={text.sourceUrl} target="_blank" rel="noreferrer" className="underline">source</a>}
      </div>
      <div className="mt-3 rounded-xl border border-line bg-card p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span>You know <strong>{stats.percent}%</strong> of the words here</span>
          <span className="text-muted">{stats.unseen} new · {stats.learning} learning</span>
          <div className="ml-auto flex items-center gap-1">
            <AddToPlaylist text={text} className="rounded px-2 py-1" />
            {audio && (
              <button
                className={`rounded px-2 py-1 text-xs ${audio.open ? "bg-accent-soft" : "text-muted hover:bg-paper"}`}
                onClick={audio.toggle}
                aria-label={audio.exists ? "Audio" : "Add audio"}
                title={audio.exists ? "Audio" : "Add audio"}
                aria-pressed={audio.open}
              >
                <HeadphonesIcon className="size-4" />
              </button>
            )}
            <SettingsMenu settings={settings} onChange={onSettings} />
            <ShortcutsMenu media={media} />
          </div>
        </div>
        <div className="mt-2"><KnownBar known={stats.known} learning={stats.learning} total={stats.total} /></div>
      </div>
    </div>
  );
}

/** Opened from a playlist: its name (back to it), this item's place in it, and the items either side. */
function PlaylistStrip({ playlist }: { playlist: ReaderPlaylist }) {
  const link = "rounded-md px-2 py-0.5 hover:bg-paper hover:text-ink";
  return (
    <nav data-testid="reader-playlist" aria-label="Playlist" className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
      <PlaylistIcon className="size-4 shrink-0" />
      <Link href={`/playlists/${playlist.id}`} className="max-w-[60vw] truncate font-medium text-ink hover:underline">{playlist.title}</Link>
      <span className="tabular-nums">{playlist.index + 1} of {playlist.total}</span>
      <span className="ml-auto flex items-center gap-1">
        {playlist.previous && <Link href={playlistReadHref(playlist.previous.id, playlist.id)} className={link} title={playlist.previous.title}>← Previous</Link>}
        {playlist.next && <Link href={playlistReadHref(playlist.next.id, playlist.id)} className={link} title={playlist.next.title}>Next →</Link>}
      </span>
    </nav>
  );
}
