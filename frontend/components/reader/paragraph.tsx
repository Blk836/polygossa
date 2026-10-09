"use client";

import { memo } from "react";
import type { Token, WordStatus } from "@/lib/types";
import type { Range } from "./reader-text";
import { wordClass } from "./word-class";

interface Props {
  tokens: Token[];
  statuses: Record<string, WordStatus>;
  sel: Range | null;
  active: number | null;
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
        return t.sentence === rest.sentence ? <span key={t.index} className="s-spoken">{t.text}</span> : t.text;
      })}
    </p>
  );
});
