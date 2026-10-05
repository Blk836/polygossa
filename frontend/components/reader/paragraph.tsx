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
  phrases: Map<number, WordStatus>;
}

export const Paragraph = memo(function Paragraph({ tokens, ...rest }: Props) {
  return (
    <p className="mb-5">
      {tokens.map((t) =>
        t.word ? (
          <span key={t.index} data-i={t.index} className={wordClass(t, rest)}>
            {t.text}
          </span>
        ) : (
          t.text
        ),
      )}
    </p>
  );
});
