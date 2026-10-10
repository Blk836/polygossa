"use client";

import Link from "next/link";
import { useState } from "react";
import { AnkiRunSummary } from "./anki-run-summary";
import { AnkiSyncTimes, useLatestAnkiRun } from "@/components/anki-sync-times";
import { Button, ErrorNote } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { syncWithAnki, type SyncResult } from "@/lib/anki-sync";
import type { AnkiDeckChoice, AnkiRun } from "@/lib/anki-types";

const MESSAGES: Partial<Record<SyncResult["kind"], string>> = {
  unreachable: "Can't reach Anki. Open Anki desktop on this computer and try again.",
  busy: "A sync is already running, perhaps in another tab. Try again in a moment.",
};

interface ButtonsProps {
  needsPreview: boolean;
  previewed: boolean;
  progress: { done: number; total: number } | null;
  onRun: (dryRun: boolean) => void;
}

function SyncButtons({ needsPreview, previewed, progress, onRun }: ButtonsProps) {
  const busy = progress !== null;
  const preview = <Button variant={needsPreview ? "primary" : "secondary"} onClick={() => onRun(true)} disabled={busy}>Preview</Button>;
  const elsewhere = <span className="text-sm text-muted">Syncing happens on <Link href="/vocabulary" className="underline">Practice → Words</Link>.</span>;
  let buttons = <>{preview}{elsewhere}</>;
  if (previewed) buttons = <Button onClick={() => onRun(false)} disabled={busy}>Start syncing</Button>;
  else if (needsPreview) buttons = preview;
  return (
    <div className="flex flex-wrap items-center gap-3">
      {buttons}
      {progress && <span className="text-sm text-muted" role="status">Reading cards: {progress.done} of {progress.total}</span>}
    </div>
  );
}

export function AnkiSyncPanel({ decks, onSynced }: { decks: AnkiDeckChoice[]; onSynced: () => void }) {
  const [latest, setLatest] = useLatestAnkiRun();
  const [preview, setPreview] = useState<AnkiRun | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const needsPreview = decks.some((d) => !d.firstSyncedAt);

  async function run(dryRun: boolean) {
    setMessage(null);
    try {
      const result = await syncWithAnki({ dryRun, onlySyncedBefore: false, onProgress: (done, total) => setProgress({ done, total }) });
      setMessage(MESSAGES[result.kind] ?? null);
      if (result.kind === "done" && dryRun) setPreview(result.run);
      if ((result.kind === "done" || result.kind === "stopped") && !dryRun) {
        setPreview(null);
        setLatest(result.run);
        onSynced();
      }
    } catch (e) {
      setMessage(errorMessage(e));
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Sync</h3>
      {latest && !needsPreview && <p className="text-sm text-muted">Anki · <AnkiSyncTimes run={latest} /></p>}
      {needsPreview && !preview && <p className="text-sm text-muted">Before the first sync of a deck, see what it will change.</p>}
      {preview && <AnkiRunSummary run={preview} preview />}
      <SyncButtons needsPreview={needsPreview} previewed={preview !== null} progress={progress} onRun={run} />
      <ErrorNote message={message} />
      {latest && !preview && <AnkiRunSummary run={latest} preview={false} />}
    </div>
  );
}
