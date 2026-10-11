"use client";

import Link from "next/link";
import { playlistReadHref } from "@/lib/playlists";
import type { ReaderPlaylist } from "@/lib/playlist-types";
import type { LanguageCode } from "@/lib/types";
import { Polly } from "../polly";
import { Button } from "../ui";
import { WritingTutor } from "./writing-tutor";

interface Props {
  visible: boolean;
  textId: number;
  language: LanguageCode;
  isPro: boolean;
  unseen: number;
  learning: number;
  finished: number | null;
  finishing: boolean;
  onFinish: () => void;
  playlist: ReaderPlaylist | null;
}

export function FinishPanel({ visible, textId, language, isPro, unseen, learning, finished, finishing, onFinish, playlist }: Props) {
  if (!visible) return null;
  if (finished === null) {
    return (
      <div data-finish="prompt" data-tour="reader-next" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-line bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium">Finished reading?</p>
          <p className="text-sm text-muted">
            {unseen > 0 ? `The ${unseen} words you didn't click will be marked as known.` : "Great — you've looked at every word."}
          </p>
        </div>
        <Button onClick={onFinish} disabled={finishing}>{finishing ? "Saving…" : "Finish lesson"}</Button>
      </div>
    );
  }
  return (
    <div data-finish="summary" className="mt-10 space-y-6">
      <div className="rounded-xl border border-accent/40 bg-accent-soft/40 p-5">
        <p className="flex items-center gap-2 text-lg font-semibold"><Polly mood="cheering" className="size-12 shrink-0" />Lesson complete</p>
        <p className="mt-1 text-sm">
          {finished} new words marked as known. You&apos;re learning {learning} words from this text.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {playlist?.next && (
            <Link href={playlistReadHref(playlist.next.id, playlist.id)} className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-ink">
              Next in playlist: {playlist.next.title}
            </Link>
          )}
          <Link href="/review" className="rounded-lg bg-accent px-3 py-1.5 text-sm text-accent-ink">Review your words</Link>
          <Link href="/library" className="rounded-lg border border-line bg-card px-3 py-1.5 text-sm">Back to library</Link>
        </div>
      </div>
      <WritingTutor textId={textId} language={language} isPro={isPro} />
    </div>
  );
}
