"use client";

import { useState } from "react";
import { Button, FailureNote } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { languageName } from "@/lib/languages";
import type { CefrLevel, WritingTest } from "@/lib/types";
import { WRITING_LEVELS } from "@/lib/writing";

/** Pick a level and start; the rules are stated up front because they're strict. */
export function StartPanel({ language, onStarted }: { language: string; onStarted: (t: WritingTest) => void }) {
  const [level, setLevel] = useState<CefrLevel>("B1");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      onStarted(await api<WritingTest>("writing/tests", { body: { language, level } }));
    } catch (e) {
      setError(e instanceof ApiError ? e : String(e));
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-xl font-semibold">Start a writing test</h2>
      <ul className="mt-3 space-y-1 text-sm text-muted">
        <li>• You get one situation to write about in {languageName(language)}. It can&apos;t be swapped.</li>
        <li>• You have 5 minutes. Pasting is off.</li>
        <li>• Reach the minimum length to hand in early; at 0:00 your answer is handed in as it is.</li>
        <li>• It&apos;s graded on task, grammar, vocabulary and coherence, with corrections.</li>
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-lg border border-line bg-paper p-1 text-sm" role="radiogroup" aria-label="Level">
          {WRITING_LEVELS.map((l) => (
            <button key={l} type="button" role="radio" aria-checked={level === l} onClick={() => setLevel(l)}
              className={`rounded-md px-3 py-1 ${level === l ? "bg-card font-medium shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}>
              {l}
            </button>
          ))}
        </div>
        <Button onClick={() => void start()} disabled={busy}>{busy ? "Starting…" : "Start the 5-minute test"}</Button>
      </div>
      <FailureNote error={error} />
    </div>
  );
}

const STATUS: Record<WritingTest["status"], string> = {
  in_progress: "In progress",
  expired: "Not handed in",
  ungraded: "Not graded yet",
  graded: "",
};

/** Past tests in this language, newest first. */
export function WritingHistory({ tests, onOpen }: { tests: WritingTest[]; onOpen: (t: WritingTest) => void }) {
  const done = tests.filter((t) => t.status === "graded" || t.status === "ungraded" || t.status === "expired");
  if (done.length === 0) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 font-display text-lg font-semibold">Past tests</h2>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {done.map((t) => (
          <li key={t.id}>
            <button type="button" disabled={t.status === "expired"} onClick={() => onOpen(t)}
              className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-paper disabled:cursor-default disabled:hover:bg-card">
              <span className="w-12 shrink-0 font-display text-2xl font-semibold tabular-nums">{t.grade ? t.grade.score : "–"}</span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-sm">{t.prompt}</span>
                <span className="text-xs text-muted">
                  {t.level} · {new Date(t.startedAt).toLocaleDateString()}{STATUS[t.status] && ` · ${STATUS[t.status]}`}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
