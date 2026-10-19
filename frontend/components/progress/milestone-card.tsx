import { languageName } from "@/lib/languages";
import { baseWords, milestone } from "@/lib/progress";
import type { LanguageCode } from "@/lib/types";

export function MilestoneCard({ known, knownBase, language }: { known: number; knownBase: number; language: LanguageCode | null }) {
  const m = milestone(known);
  const name = language ? `${languageName(language)} ` : "";
  return (
    <section aria-label="Known words" className="flex flex-col rounded-xl border border-line bg-card p-5">
      <p className="text-sm text-muted">Known {name}words</p>
      <p className="mt-1 font-display text-4xl font-semibold tabular-nums" data-testid="known-words">{known.toLocaleString()}</p>
      <p className="text-sm text-muted tabular-nums" data-testid="known-base-words">{baseWords(knownBase)}</p>
      <div className="mt-auto pt-5">
        <div
          role="progressbar"
          aria-label={`Progress to ${m.to.toLocaleString()} known words`}
          aria-valuemin={m.from}
          aria-valuemax={m.to}
          aria-valuenow={known}
          className="h-2.5 w-full overflow-hidden rounded-full bg-accent-soft"
        >
          <div className="h-full rounded-full bg-accent" style={{ width: `${m.fraction * 100}%` }} />
        </div>
        <p className="mt-2 text-sm" data-testid="milestone">
          <span className="font-semibold tabular-nums">{m.remaining.toLocaleString()}</span> more to reach{" "}
          <span className="font-semibold tabular-nums">{m.to.toLocaleString()}</span>
        </p>
      </div>
    </section>
  );
}
