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
  hover: Range | null;
}

const inside = (i: number, r: Range | null) => r !== null && i >= r.start && i <= r.end;

function bandClass(i: number, sel: Range | null): string {
  if (!inside(i, sel)) return "";
  return ["sel", i === sel!.start && "sel-start", i === sel!.end && "sel-end"].filter(Boolean).join(" ");
}

function extraClass(i: number, sel: Range | null, edges: Edges, hover: Range | null): string {
  return [edges.starts.has(i) && "p-start", edges.ends.has(i) && "p-end", inside(i, hover) && "p-hover", bandClass(i, sel)]
    .filter(Boolean).join(" ");
}

function gapClass(t: Token, { sel, sentence, gaps, hover }: Pick<Props, "sel" | "sentence" | "gaps" | "hover">): string {
  return [t.sentence === sentence && "s-spoken", gaps.has(t.index) && "p-learning", inside(t.index, hover) && "p-hover", bandClass(t.index, sel)]
    .filter(Boolean).join(" ");
}

export const Paragraph = memo(function Paragraph({ tokens, gaps, edges, hover, ...rest }: Props) {
  return (
    <p className="mb-5">
      {tokens.map((t) => {
        if (t.word) {
          const extra = extraClass(t.index, rest.sel, edges, hover);
          return (
            <span key={t.index} data-i={t.index} className={extra ? `${wordClass(t, rest)} ${extra}` : wordClass(t, rest)}>
              {t.text}
            </span>
          );
        }
        const cls = gapClass(t, { sel: rest.sel, sentence: rest.sentence, gaps, hover });
        return cls ? <span key={t.index} className={cls}>{t.text}</span> : t.text;
      })}
    </p>
  );
});
