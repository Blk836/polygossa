"use client";

import { languageInfo } from "@/lib/languages";
import type { LanguageCode, TextDetail } from "@/lib/types";
import { FONT_SIZES } from "./reader-header";
import { pageOfToken, type ReaderPage } from "./reader-pages";
import type { ReaderSettings } from "./reader-settings";
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

export function mediaState(video: boolean, audio: TextDetail["audio"], showAudio: boolean) {
  return {
    shortcuts: video || (showAudio && !!audio),
    audioPanel: showAudio && !video,
    playerBar: video || showAudio,
    synced: video || hasSyncedAudio(audio),
  };
}

export function audioToggle(audio: TextDetail["audio"], isOwner: boolean, isVideo: boolean, open: boolean, toggle: () => void) {
  if (isVideo || (!audio && !isOwner)) return null;
  return { open, exists: !!audio, toggle };
}

export function PhraseHint({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-sm">Tap the last word of the phrase.</p>;
}

export function onPage(target: PopupTarget | null, pages: ReaderPage[], page: number, reach = 0): PopupTarget | null {
  return target && Math.abs(pageOfToken(pages, target.startToken) - page) <= reach ? target : null;
}

export function layoutProps(settings: Pick<ReaderSettings, "width" | "video">, video: boolean, playerBar: boolean) {
  return {
    "data-reader": "",
    "data-text-width": settings.width,
    "data-video-layout": video ? settings.video : undefined,
    className: playerBar ? "pb-12" : undefined,
  };
}

export function pageNote(pageKnown: boolean, page: number, count: number, unseen: number, unit: "page" | "sentence" = "page"): string | null {
  if (!pageKnown || page >= count || unseen === 0) return null;
  const words = `${unseen} new ${unseen === 1 ? "word" : "words"}`;
  return unit === "page" ? `Turning the page marks the ${words} on this page as known.` : `Moving on marks the ${words} in this sentence as known.`;
}

export function showsMarker(followWord: boolean, playerBar: boolean): boolean {
  return followWord && playerBar;
}
