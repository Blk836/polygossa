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
import { SettingsMenu, ShortcutsMenu, toolButton } from "./reader-menus";
import type { ReaderSettings } from "./reader-settings";
import type { ReaderStats } from "./reader-text";

export const FONT_SIZES = ["text-lg", "text-xl", "text-2xl", "text-3xl"];

interface Props {
  text: TextSummary;
  playlist: ReaderPlaylist | null;
  stats: ReaderStats;
  settings: ReaderSettings;
  onSettings: (change: Partial<ReaderSettings>) => void;
  audio: { open: boolean; exists: boolean; toggle: () => void } | null;
  media: boolean;
}

export function ReaderHeader({ text, playlist, stats, settings, onSettings, audio, media }: Props) {
  return (
    <div className="mb-5">
      {playlist ? <PlaylistStrip playlist={playlist} /> : <Link href="/library" className="text-sm text-muted hover:text-ink">← Library</Link>}
      <div className="mt-1 flex items-center gap-3">
        <h1 title={text.title} className="line-clamp-2 min-w-0 flex-1 font-display text-2xl leading-tight font-semibold tracking-tight sm:text-[1.75rem]">
          {text.title}
        </h1>
        <div className="flex shrink-0 items-center gap-0.5">
          <AddToPlaylist text={text} className={toolButton} />
          {audio && (
            <button
              className={`${toolButton} ${audio.open ? "bg-accent-soft text-ink" : ""}`}
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
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted">
        <LevelBadge level={text.cefrLevel} />
        <span>{languageName(text.language)} · {text.wordCount.toLocaleString()} words</span>
        {!text.mine && <span>· shared by <Named name={text.owner.displayName} photoUrl={text.owner.photoUrl} /></span>}
        {text.sourceUrl && <a href={text.sourceUrl} target="_blank" rel="noreferrer" className="underline decoration-line underline-offset-2 hover:text-ink">source</a>}
        <KnownLine stats={stats} />
      </div>
    </div>
  );
}

function KnownLine({ stats }: { stats: ReaderStats }) {
  return (
    <div data-testid="reader-known" className="flex w-full items-center gap-3 sm:ml-auto sm:w-auto">
      <span className="whitespace-nowrap">
        You know <strong className="font-semibold text-ink">{stats.percent}%</strong><span className="hidden sm:inline"> of the words</span>
      </span>
      <div className="min-w-12 flex-1 sm:w-28 sm:flex-none"><KnownBar known={stats.known} learning={stats.learning} total={stats.total} /></div>
      <span className="whitespace-nowrap tabular-nums">{stats.unseen} new · {stats.learning} learning</span>
    </div>
  );
}

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
