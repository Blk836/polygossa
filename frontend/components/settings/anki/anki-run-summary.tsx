"use client";

import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { outcomeLines, type OutcomeLine } from "@/lib/anki-outcomes";
import type { AnkiRun } from "@/lib/anki-types";

function WordList({ run, line }: { run: AnkiRun; line: OutcomeLine }) {
  const [words, setWords] = useState<string[] | null>(null);
  function toggle(open: boolean) {
    if (!open || words) return;
    api<{ words: string[] }>(`anki/runs/${run.id}/words?outcome=${line.outcome}`).then((r) => setWords(r.words)).catch(() => setWords([]));
  }
  return (
    <details onToggle={(e) => toggle(e.currentTarget.open)} data-testid={`anki-${line.outcome}`}>
      <summary className="cursor-pointer">
        {line.label}
        {line.outcome === "over_limit" && <> (<Link href="/settings/subscription" className="underline">see plans</Link>)</>}
      </summary>
      <p className="mt-1 max-h-40 overflow-y-auto rounded bg-paper p-2 text-xs" data-testid="anki-words">{words ? words.join(", ") || "None" : "Loading…"}</p>
    </details>
  );
}

function when(run: AnkiRun): string {
  return new Date(run.finishedAt ?? run.startedAt).toLocaleString();
}

function RunHeader({ run, preview }: { run: AnkiRun; preview: boolean }) {
  if (preview) return <p className="text-muted">{run.cards} cards read from Anki. Nothing has changed yet.</p>;
  if (run.state === "stopped") return <p role="alert" className="font-medium">Sync stopped: Anki closed. The next sync carries on.</p>;
  if (run.state === "running") return <p className="text-muted">Syncing…</p>;
  return <p className="text-muted">Last synced {when(run)}, {run.cards} cards read.</p>;
}

export function AnkiRunSummary({ run, preview }: { run: AnkiRun; preview: boolean }) {
  const lines = outcomeLines(run, preview);
  return (
    <div className="space-y-2 text-sm" data-testid={preview ? "anki-preview" : "anki-result"}>
      <RunHeader run={run} preview={preview} />
      {lines.length ? <div className="space-y-1">{lines.map((l) => <WordList key={l.outcome} run={run} line={l} />)}</div> : <p>No words change.</p>}
      {preview && (run.becameKnown > 0 || run.addedKnown > 0) && (
        <p className="text-muted">These words count toward your known total, but not as words learned this week, since you learned them before.</p>
      )}
    </div>
  );
}
