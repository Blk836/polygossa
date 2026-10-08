"use client";

import { memo } from "react";
import type { Token, WordStatus } from "@/lib/types";
import type { Range } from "./reader-text";
import { wordClass } from "./word-class";

interface Props {
  tokens: Token[];
  statuses: Record<string, WordStatus>;
  /** The selection, only when it overlaps this paragraph (keeps memoization effective). */
  sel: Range | null;
  /** The word being spoken, only when it's in this paragraph. */
  active: number | null;
  /** The sentence being spoken, only when it's in this paragraph. */
  sentence: number | null;
  phrases: Map<number, WordStatus>;
}

export const Paragraph = memo(function Paragraph({ tokens, ...rest }: Props) {
  return (
    <p className="mb-5">
      {tokens.map((t) => {
        if (t.word) {
          return (
            <span key={t.index} data-i={t.index} className={wordClass(t, rest)}>
              {t.text}
            </span>
          );
        }
        // The spaces and punctuation of the spoken sentence are tinted too, so it reads as one band.
        return t.sentence === rest.sentence ? <span key={t.index} className="s-spoken">{t.text}</span> : t.text;
      })}
    </p>
  );
});
