"use client";

import { useEffect, useState } from "react";
import { ANKI_SYNC_EVERY_MS, ANKI_SYNCED_EVENT, useAnkiSync } from "./anki-auto-sync";
import { api } from "@/lib/api";
import { nextSyncText, syncedAgoText } from "@/lib/anki-sync-status";
import type { AnkiRun } from "@/lib/anki-types";

export function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export function useLatestAnkiRun(): [AnkiRun | null, (run: AnkiRun | null) => void] {
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

export function syncedAt(run: AnkiRun): number {
  return new Date(run.finishedAt ?? run.startedAt).getTime();
}

export function useSyncTimes(run: AnkiRun | null): { synced: string; next: string | null } {
  const { nextAt, finished } = useAnkiSync();
  const ticked = useNow();
  const now = nextAt ? Math.max(ticked, nextAt - ANKI_SYNC_EVERY_MS) : ticked;
  const at = run && (finished?.runId === run.id ? finished.at : syncedAt(run));
  return {
    synced: at ? `synced ${syncedAgoText(now - at)}` : "not synced yet",
    next: nextAt ? nextSyncText(nextAt - now) : null,
  };
}

export function AnkiSyncTimes({ run }: { run: AnkiRun | null }) {
  const { synced, next } = useSyncTimes(run);
  return <span data-testid="anki-sync-times">{next ? `${synced} · ${next}` : synced}</span>;
}
