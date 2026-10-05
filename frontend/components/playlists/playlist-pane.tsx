"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { readingProgress } from "@/lib/card-status";
import { formatVideoLength } from "@/lib/media";
import { itemsLabel, nextUp, playlistReadHref, startLabel } from "@/lib/playlists";
import type { PlaylistDetail, PlaylistSummary } from "@/lib/playlist-types";
import type { TextSummary } from "@/lib/types";
import { CheckIcon, CloseIcon, PlaylistIcon } from "../icons";
import { ErrorNote, LinkButton, Spinner } from "../ui";

/**
 * A popup for one playlist, a bottom sheet on phones and centred from the sm breakpoint up: its title and progress,
 * Start / Continue, and a scrollable list of every episode, each opening the reader as part of the playlist. Escape,
 * the close button or a click outside closes it.
 */
export function PlaylistPane({ playlist, onClose }: { playlist: PlaylistSummary; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
    let cancelled = false;
    api<PlaylistDetail>(`playlists/${playlist.id}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [playlist.id]);

  const summary = detail?.playlist ?? playlist;
  return (
    <dialog
      ref={dialog} aria-label={playlist.title} onClose={onClose}
      onClick={(e) => e.target === dialog.current && dialog.current.close()}
      className={"fixed inset-x-0 top-auto bottom-0 m-0 max-h-[90dvh] w-full max-w-none flex-col overflow-hidden rounded-t-2xl open:flex border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-black/40 " +
        "sm:inset-0 sm:m-auto sm:max-h-[85dvh] sm:w-[min(36rem,calc(100vw-2rem))] sm:rounded-2xl"}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="space-y-2 border-b border-line p-5">
          <div className="flex items-start gap-3">
            <p className="flex items-center gap-1 text-[11px] font-semibold tracking-wide text-rubric uppercase"><PlaylistIcon className="size-4" />Playlist</p>
            <button type="button" onClick={() => dialog.current?.close()} aria-label="Close" className="ml-auto rounded-md p-1 text-muted hover:bg-paper hover:text-ink">
              <CloseIcon />
            </button>
          </div>
          <h2 className="font-display text-2xl leading-tight font-semibold" lang={summary.language}>{summary.title}</h2>
          {!summary.mine && <p className="text-sm text-muted">by {summary.owner.displayName}</p>}
          {summary.description && <p className="line-clamp-3 text-sm text-muted">{summary.description}</p>}
          <p className="text-sm text-muted">{itemsLabel(summary)}</p>
          <Actions detail={detail} playlistId={playlist.id} />
        </header>
        <ErrorNote message={error} />
        {!detail && !error && <div className="p-5"><Spinner /></div>}
        <ol data-testid="playlist-pane-items" className="safe-bottom min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
          {detail?.items.map((t, i) => <Episode key={t.id} text={t} index={i} playlistId={playlist.id} />)}
        </ol>
      </div>
    </dialog>
  );
}

function Actions({ detail, playlistId }: { detail: PlaylistDetail | null; playlistId: number }) {
  const next = detail ? nextUp(detail.items) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 pt-1">
      {detail && next && <LinkButton href={playlistReadHref(next.id, playlistId)}>{startLabel(detail.items)}</LinkButton>}
      <LinkButton href={`/playlists/${playlistId}`} variant="secondary">Playlist page</LinkButton>
    </div>
  );
}

/** "Finished", or how far along an opened episode is. */
function ProgressNote({ text }: { text: TextSummary }) {
  const p = readingProgress(text.progress);
  if (!p) return null;
  if (p.finished) return <span className="flex items-center gap-0.5 font-semibold text-good"><CheckIcon className="size-3.5" aria-hidden />Finished</span>;
  return <span>· {p.label}</span>;
}

/** One row: number, a small thumbnail, the title, and length plus how far the viewer has read. */
function Episode({ text, index, playlistId }: { text: TextSummary; index: number; playlistId: number }) {
  const p = readingProgress(text.progress);
  const length = text.kind === "video" ? formatVideoLength(text.video?.durationSeconds) : `${text.wordCount.toLocaleString()} words`;
  return (
    <li>
      <Link href={playlistReadHref(text.id, playlistId)} className="flex items-center gap-3 rounded-lg p-2 hover:bg-paper" lang={text.language}>
        <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">{index + 1}</span>
        <span className={`relative aspect-[16/9] w-24 shrink-0 overflow-hidden rounded-md ${text.video ? "bg-line" : `cover cover-${text.category}`}`}>
          {text.video && <Image src={text.video.thumbnailUrl} alt="" fill sizes="96px" className="object-cover" />}
          {p && !p.finished && <span className="absolute inset-x-0 bottom-0 h-1 bg-ink/25"><span className="block h-full bg-rubric" style={{ width: `${Math.max(p.percent, 3)}%` }} /></span>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-2 text-sm leading-snug font-medium">{text.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">{length}<ProgressNote text={text} /></span>
        </span>
      </Link>
    </li>
  );
}
