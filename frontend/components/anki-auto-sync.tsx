"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useMe } from "./me-context";
import { syncWithAnki, type SyncResult } from "@/lib/anki-sync";

export const ANKI_SYNC_EVERY_MS = 15 * 60 * 1000;
export const ANKI_SYNCED_EVENT = "anki-synced";

export type AnkiSyncProblem = "unreachable" | "busy" | "failed";

export interface AnkiSyncState {
  progress: { done: number; total: number } | null;
  problem: AnkiSyncProblem | null;
  nextAt: number | null;
  finished: { runId: number; at: number } | null;
}

const IDLE: AnkiSyncState = { progress: null, problem: null, nextAt: null, finished: null };
const PROBLEMS: Partial<Record<SyncResult["kind"], AnkiSyncProblem>> = { unreachable: "unreachable", busy: "busy" };

let state = IDLE;
let scheduled = false;
let timer: number | undefined;
const listeners = new Set<() => void>();

function update(patch: Partial<AnkiSyncState>) {
  state = { ...state, ...patch };
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAnkiSync(): AnkiSyncState {
  return useSyncExternalStore(subscribe, () => state, () => IDLE);
}

function subscribePointer(listener: () => void) {
  const query = window.matchMedia("(pointer: fine)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export function useFinePointer(): boolean {
  return useSyncExternalStore(subscribePointer, () => window.matchMedia("(pointer: fine)").matches, () => false);
}

async function sync(manual: boolean) {
  update({ progress: { done: 0, total: 0 }, problem: null });
  try {
    const result = await syncWithAnki({ dryRun: false, onlySyncedBefore: true, onProgress: (done, total) => update({ progress: { done, total } }) });
    const problem = PROBLEMS[result.kind] ?? null;
    update({ progress: null, problem: manual || problem === "unreachable" ? problem : null });
    if (result.kind === "done" || result.kind === "stopped") {
      update({ finished: { runId: result.run.id, at: Date.now() } });
      window.dispatchEvent(new CustomEvent(ANKI_SYNCED_EVENT, { detail: result }));
    }
  } catch {
    update({ progress: null, problem: manual ? "failed" : null });
  }
}

function scheduleNext() {
  window.clearTimeout(timer);
  if (!scheduled) return;
  update({ nextAt: Date.now() + ANKI_SYNC_EVERY_MS });
  timer = window.setTimeout(() => void syncAnki(false), ANKI_SYNC_EVERY_MS);
}

export async function syncAnki(manual: boolean) {
  if (state.progress) return;
  const run = () => sync(manual);
  if (navigator.locks) {
    await navigator.locks.request("anki-sync", { ifAvailable: true }, (lock) => (lock ? run() : manual ? update({ problem: "busy" }) : undefined));
  } else {
    await run();
  }
  scheduleNext();
}

export function AnkiAutoSync() {
  const { me } = useMe();
  const connected = me.ankiConnected;
  useEffect(() => {
    if (!connected || !window.matchMedia("(pointer: fine)").matches) return;
    scheduled = true;
    void syncAnki(false);
    return () => {
      scheduled = false;
      window.clearTimeout(timer);
      update({ nextAt: null });
    };
  }, [connected]);
  return null;
}
