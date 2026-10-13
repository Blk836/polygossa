"use client";

import { forwardRef } from "react";
import type { LanguageCode, WordLookup, WordStatus } from "@/lib/types";
import { WordPopup, type PopupTarget } from "./word-popup";

interface Props {
  target: PopupTarget | null;
  language: LanguageCode;
  speechLocale: string;
  status: WordStatus | undefined;
  statuses: Record<string, WordStatus>;
  onOpenWord: (index: number) => void;
  onBack: () => void;
  isPro: boolean;
  notice: string | null;
  hasAudio: boolean;
  onStatus: (status: WordStatus | null) => void;
  onLookup: (lookup: WordLookup) => void;
  onPickMeaning: (meaning: string) => void;
  onSaveSentence: (translation?: string) => Promise<void>;
  onPlayFromHere: () => void;
  onPhraseMode: () => void;
  onClose: () => void;
}

export const ReaderPopup = forwardRef<HTMLDivElement, Props>(function ReaderPopup({ onPhraseMode, ...popup }, ref) {
  const { target } = popup;
  if (!target) return null;
  return (
    <div
      ref={ref}
      data-word-popup
      className="fixed inset-x-0 bottom-0 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-(--pt) sm:left-(--pl) sm:w-[22rem]"
    >
      <WordPopup key={`${target.kind}:${target.term}:${target.startToken}`} {...popup} target={target} />
      {target.kind === "word" && (
        <button onClick={onPhraseMode} className="w-full bg-card py-2 text-xs text-accent sm:hidden">
          Select a phrase starting here
        </button>
      )}
    </div>
  );
});
