"use client";

import { useEffect, useState } from "react";
import { AnkiRunSummary } from "./anki-run-summary";
import { ANKI_SYNCED_EVENT } from "@/components/anki-auto-sync";
import { Button, ErrorNote } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { syncWithAnki, type SyncResult } from "@/lib/anki-sync";
import type { AnkiDeckChoice, AnkiRun } from "@/lib/anki-types";

const MESSAGES: Partial<Record<SyncResult["kind"], string>> = {
  unreachable: "Can't reach Anki. Open Anki desktop on this computer and try again.",
  busy: "A sync is already running, perhaps in another tab. Try again in a moment.",
};

function useLatestRun(): [AnkiRun | null, (run: AnkiRun | null) => void] {
  const [latest, setLatest] = useState<AnkiRun | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => api<AnkiRun | null>("anki/runs/latest").then((r) => !cancelled && setLatest(r)).catch(() => undefined);
    load();
    window.addEventListener(ANKI_SYNCED_EVENT, load);
    return () => {
      cancelled = true;
      window.removeEventListener(ANKI_SYNCED_EVENT, load);
    };
  }, []);
  return [latest, setLatest];
}

interface ButtonsProps {
  needsPreview: boolean;
  previewed: boolean;
  progress: { done: number; total: number } | null;
  onRun: (dryRun: boolean) => void;
}

function SyncButtons({ needsPreview, previewed, progress, onRun }: ButtonsProps) {
  const busy = progress !== null;
  const preview = <Button variant={needsPreview ? "primary" : "secondary"} onClick={() => onRun(true)} disabled={busy}>Preview</Button>;
  let buttons = <><Button onClick={() => onRun(false)} disabled={busy}>Sync now</Button>{preview}</>;
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
  const [latest, setLatest] = useLatestRun();
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
      {needsPreview && !preview && <p className="text-sm text-muted">Before the first sync of a deck, see what it will change.</p>}
      {preview && <AnkiRunSummary run={preview} preview />}
      <SyncButtons needsPreview={needsPreview} previewed={preview !== null} progress={progress} onRun={run} />
      <ErrorNote message={message} />
      {latest && !preview && <AnkiRunSummary run={latest} preview={false} />}
    </div>
  );
}
