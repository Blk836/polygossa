"use client";

import Link from "next/link";
import { useState } from "react";
import { closeWord, demoCounts, initialDemoState, selectWord, setDemoStatus, signupHref, type DemoStatus } from "@/lib/landing";
import { DEMOS } from "@/lib/landing-demos";
import { LANGUAGES } from "@/lib/languages";
import type { LanguageCode } from "@/lib/types";

const STATUS_BUTTONS: { status: DemoStatus; label: string; className: string }[] = [
  { status: "learning", label: "Learning", className: "bg-learning" },
  { status: "known", label: "Known", className: "bg-known" },
];

/** The landing page's try-it-now reader: a sample sentence per language whose words open a definition card. */
export function DemoReader() {
  const [language, setLanguage] = useState<LanguageCode>("es");
  const [state, setState] = useState(() => initialDemoState(DEMOS.es));
  const tokens = DEMOS[language];
  const info = LANGUAGES.find((l) => l.code === language)!;
  const counts = demoCounts(state);
  const selected = state.selected === null ? null : tokens[state.selected];

  function switchTo(code: LanguageCode) {
    setLanguage(code);
    setState(initialDemoState(DEMOS[code]));
  }

  return (
    <div className="relative rounded-2xl border border-line bg-card shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)]" data-testid="demo">
      <div role="tablist" aria-label="Demo language" className="flex overflow-x-auto border-b border-line px-2 pt-2">
        {LANGUAGES.map((l) => (
          <button
            key={l.code}
            role="tab"
            aria-selected={l.code === language}
            onClick={() => switchTo(l.code)}
            className={`shrink-0 grow border-b-2 px-1.5 pb-2 pt-1.5 text-sm transition ${
              l.code === language ? "border-rubric font-semibold text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {l.native}
          </button>
        ))}
      </div>

      <div className="p-5 md:p-6">
        <p lang={language} className={`reading text-2xl ${info.cjk ? "reading-cjk" : ""}`} data-testid="demo-text">
          {tokens.map((t, i) =>
            t.word ? (
              <span
                key={i}
                role="button"
                tabIndex={0}
                aria-pressed={state.selected === i}
                data-status={state.statuses[i]}
                onClick={() => setState(selectWord(state, i))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setState(selectWord(state, i));
                  }
                }}
                className={`w w-${state.statuses[i]} ${state.selected === i ? "w-selected" : ""}`}
              >
                {t.text}
              </span>
            ) : (
              <span key={i}>{t.text}</span>
            ),
          )}
        </p>

        <div className="mt-5 min-h-36" aria-live="polite">
          {selected?.word ? (
            <div className="rounded-xl border border-line bg-paper p-4" data-testid="demo-card">
              <div className="flex items-baseline gap-2">
                <span lang={language} className="font-reading text-xl font-semibold">{selected.text}</span>
                <span className="text-sm text-muted">{[selected.word.reading, selected.word.pos].filter(Boolean).join(" · ")}</span>
                <button onClick={() => setState(closeWord(state))} className="ml-auto text-muted hover:text-ink" aria-label="Close">✕</button>
              </div>
              <p className="mt-1">{selected.word.meaning}</p>
              <div className="mt-3 flex gap-2 text-sm">
                {STATUS_BUTTONS.map((b) => (
                  <button
                    key={b.status}
                    onClick={() => setState(setDemoStatus(state, b.status))}
                    aria-pressed={state.statuses[state.selected!] === b.status}
                    className={`rounded-md border px-2.5 py-1 transition ${
                      state.statuses[state.selected!] === b.status ? `${b.className} border-transparent font-medium` : "border-line hover:bg-card"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="flex h-full items-center rounded-xl border border-dashed border-line px-4 py-6 text-sm text-muted">
              Tap a <span className="w w-new mx-1 px-1">blue</span> word to see what it means.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div className="min-w-40 flex-1">
            <p className="text-sm text-muted">
              You know <span className="font-semibold text-ink" data-testid="demo-known">{counts.known}</span> of {counts.total} words
            </p>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-good transition-all" style={{ width: `${counts.percent}%` }} />
            </div>
          </div>
          {state.lookups > 0 && (
            <Link href={signupHref(language)} className="text-sm font-medium text-accent underline underline-offset-4">
              Save these words — create a free account →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
