"use client";

import { memo, type Ref } from "react";
import type { Token } from "@/lib/types";
import { FinishPrompt } from "./finish-panel";

const nothing = () => {};

export const TextMeasure = memo(function TextMeasure({ paragraphs, className, unseen, ref }: {
  paragraphs: Token[][];
  className: string;
  unseen: number;
  ref: Ref<HTMLDivElement>;
}) {
  return (
    <div aria-hidden inert className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
      <div ref={ref} className={className}>
        {paragraphs.map((p, k) => (
          <p key={k} className="mb-5">
            {p.map((t, j) => (t.word ? <span key={j} data-m={t.index} className="w">{t.text}</span> : t.text))}
          </p>
        ))}
      </div>
      <FinishPrompt data-finish-measure="" unseen={unseen} finishing={false} onFinish={nothing} />
    </div>
  );
});
