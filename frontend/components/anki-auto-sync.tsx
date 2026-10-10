"use client";

import { useEffect } from "react";
import { useMe } from "./me-context";
import { syncWithAnki } from "@/lib/anki-sync";

export const ANKI_SYNC_EVERY_MS = 15 * 60 * 1000;
export const ANKI_SYNCED_EVENT = "anki-synced";

async function syncQuietly() {
  const run = async () => {
    try {
      const result = await syncWithAnki({ dryRun: false, onlySyncedBefore: true });
      window.dispatchEvent(new CustomEvent(ANKI_SYNCED_EVENT, { detail: result }));
    } catch {
      return;
    }
  };
  if (navigator.locks) await navigator.locks.request("anki-sync", { ifAvailable: true }, (lock) => (lock ? run() : undefined));
  else await run();
}

export function AnkiAutoSync() {
  const { me } = useMe();
  const connected = me.ankiConnected;
  useEffect(() => {
    if (!connected || !window.matchMedia("(pointer: fine)").matches) return;
    void syncQuietly();
    const timer = window.setInterval(() => void syncQuietly(), ANKI_SYNC_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [connected]);
  return null;
}
