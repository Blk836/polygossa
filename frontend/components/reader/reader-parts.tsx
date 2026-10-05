"use client";

import { languageInfo } from "@/lib/languages";
import type { LanguageCode, TextDetail } from "@/lib/types";
import { FONT_SIZES } from "./reader-header";
import { pageOfToken, type ReaderPage } from "./reader-pages";
import type { PopupTarget } from "./word-popup";

export function articleClass(language: LanguageCode, size: number, quiet: boolean): string {
  const classes = ["reading", FONT_SIZES[size]];
  if (languageInfo(language)?.cjk) classes.push("reading-cjk");
  if (quiet) classes.push("reader-quiet");
  return classes.join(" ");
}

function hasSyncedAudio(audio: TextDetail["audio"]): boolean {
  return !!audio && audio.timings.length > 0;
}

/** What media the reader shows: playback shortcuts, the audio panel, room for the player bar, "play from here". */
export function mediaState(video: boolean, audio: TextDetail["audio"], showAudio: boolean) {
  return {
    shortcuts: video || (showAudio && !!audio),
    audioPanel: showAudio && !video,
    playerBar: video || showAudio,
    synced: video || hasSyncedAudio(audio),
  };
}

/** The header's audio button: shown when there is audio, or to the owner so they can add some. Videos have none. */
export function audioToggle(audio: TextDetail["audio"], isOwner: boolean, isVideo: boolean, open: boolean, toggle: () => void) {
  if (isVideo || (!audio && !isOwner)) return null;
  return { open, exists: !!audio, toggle };
}

export function PhraseHint({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">Tap the last word of the phrase.</p>;
}

/** The popup target if its word is on the page being shown, else null. */
export function onPage(target: PopupTarget | null, pages: ReaderPage[], page: number): PopupTarget | null {
  return target && pageOfToken(pages, target.startToken) === page ? target : null;
}

/**
 * The page column: one reading column for every kind; videos add a second column for the player on wide screens.
 * Room is left at the bottom for the player bar (with the page padding below it, a little more than the bar).
 */
export function layoutClass(video: boolean, playerBar: boolean): string {
  const classes = ["mx-auto max-w-3xl"];
  if (video) classes.push("lg:grid lg:max-w-none lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-x-8 xl:grid-cols-[minmax(0,1fr)_28rem]");
  if (playerBar) classes.push("pb-12");
  return classes.join(" ");
}

/** What turning the page will do, shown under the pager when that setting is on and there is something to mark. */
export function pageNote(pageKnown: boolean, page: number, count: number, unseen: number): string | null {
  if (!pageKnown || page >= count || unseen === 0) return null;
  return `Turning the page marks the ${unseen} new ${unseen === 1 ? "word" : "words"} on this page as known.`;
}
