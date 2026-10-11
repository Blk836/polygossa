"use client";

import { memo } from "react";
import type { Token, WordStatus } from "@/lib/types";
import type { Edges, Range } from "./reader-text";
import { wordClass } from "./word-class";

interface Props {
  tokens: Token[];
  statuses: Record<string, WordStatus>;
  sel: Range | null;
  active: number | null;
  sentence: number | null;
  phrases: Map<number, WordStatus>;
  gaps: Set<number>;
  edges: Edges;
}

function bandClass(i: number, sel: Range | null): string {
  if (!sel || i < sel.start || i > sel.end) return "";
  return ["sel", i === sel.start && "sel-start", i === sel.end && "sel-end"].filter(Boolean).join(" ");
}

function extraClass(i: number, sel: Range | null, edges: Edges): string {
  return [edges.starts.has(i) && "p-start", edges.ends.has(i) && "p-end", bandClass(i, sel)].filter(Boolean).join(" ");
}

function gapClass(t: Token, { sel, sentence, gaps }: Pick<Props, "sel" | "sentence" | "gaps">): string {
  return [t.sentence === sentence && "s-spoken", gaps.has(t.index) && "p-learning", bandClass(t.index, sel)]
    .filter(Boolean).join(" ");
}

export const Paragraph = memo(function Paragraph({ tokens, gaps, edges, ...rest }: Props) {
  return (
    <p className="mb-5">
      {tokens.map((t) => {
        if (t.word) {
          const extra = extraClass(t.index, rest.sel, edges);
          return (
            <span key={t.index} data-i={t.index} className={extra ? `${wordClass(t, rest)} ${extra}` : wordClass(t, rest)}>
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
