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
  gaps: Set<number>;
}

function bandClass(i: number, sel: Range | null): string {
  if (!sel || i < sel.start || i > sel.end) return "";
  return ["sel", i === sel.start && "sel-start", i === sel.end && "sel-end"].filter(Boolean).join(" ");
}

function gapClass(t: Token, { sel, sentence, gaps }: Pick<Props, "sel" | "sentence" | "gaps">): string {
  return [t.sentence === sentence && "s-spoken", gaps.has(t.index) && "p-learning", bandClass(t.index, sel)]
    .filter(Boolean).join(" ");
}

export const Paragraph = memo(function Paragraph({ tokens, gaps, ...rest }: Props) {
  return (
    <p className="mb-5">
      {tokens.map((t) => {
        if (t.word) {
          const band = bandClass(t.index, rest.sel);
          return (
            <span key={t.index} data-i={t.index} className={band ? `${wordClass(t, rest)} ${band}` : wordClass(t, rest)}>
              {t.text}
            </span>
          );
        }
        const cls = gapClass(t, { sel: rest.sel, sentence: rest.sentence, gaps });
        return cls ? <span key={t.index} className={cls}>{t.text}</span> : t.text;
      })}
    </p>
  );
});
