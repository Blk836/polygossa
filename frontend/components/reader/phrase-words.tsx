"use client";

import type { WordStatus } from "@/lib/types";
import type { PhraseWord } from "./word-popup";

const CHIP: Record<WordStatus | "new", string> = {
  new: "bg-new text-ink",
  learning: "bg-learning text-ink",
  known: "border border-line text-ink",
  ignored: "border border-line text-muted",
};

export function PhraseWords({ words, statuses, onOpen }: {
  words: PhraseWord[];
  statuses: Record<string, WordStatus>;
  onOpen: (index: number) => void;
}) {
  return (
    <div role="group" aria-label="Words in this phrase" className="flex flex-wrap gap-1.5">
      {words.map((w) => {
        const status = statuses[w.term] ?? "new";
        return (
          <button
            key={w.index}
            type="button"
            data-status={status}
            onClick={() => onOpen(w.index)}
            className={`rounded-md px-2 py-0.5 font-reading hover:ring-2 hover:ring-accent ${CHIP[status]}`}
          >
            {w.text}
          </button>
        );
      })}
    </div>
  );
}

export function BackToPhrase({ display, onBack }: { display: string; onBack: () => void }) {
  return (
    <button type="button" onClick={onBack} aria-label={`Back to ${display}`} className="text-xs font-medium text-accent hover:underline">
      ← {display}
    </button>
  );
}
