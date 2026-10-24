"use client";

import { memo, type Ref } from "react";
import type { Token } from "@/lib/types";
import { FinishPrompt } from "./finish-panel";

const nothing = () => {};
const hidden = "pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden";

export const TextMeasure = memo(function TextMeasure({ paragraphs, className, unseen, ref }: {
  paragraphs: Token[][];
  className: string;
  unseen: number;
  ref: Ref<HTMLDivElement>;
}) {
  return (
    <>
      <MeasuredText paragraphs={paragraphs} className={className} ref={ref} />
      <div aria-hidden inert className={hidden}>
        <FinishPrompt data-finish-measure="" unseen={unseen} finishing={false} onFinish={nothing} />
      </div>
    </>
  );
});

const MeasuredText = memo(function MeasuredText({ paragraphs, className, ref }: {
  paragraphs: Token[][];
  className: string;
  ref: Ref<HTMLDivElement>;
}) {
  return (
    <div aria-hidden className={hidden}>
      <div ref={ref} className={className}>
        {paragraphs.map((p, k) => (
          <p key={k} className="mb-5">
            {p.map((t, j) => (t.word ? <span key={j} data-m={t.index} className="w">{t.text}</span> : t.text))}
          </p>
        ))}
      </div>
    </div>
  );
});
