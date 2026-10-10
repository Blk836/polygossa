"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { syncAnki, useAnkiSync, useFinePointer, type AnkiSyncState } from "../anki-auto-sync";
import { useLatestAnkiRun, useSyncTimes } from "../anki-sync-times";
import { useMe } from "../me-context";
import { AnkiOutcomeWords } from "../settings/anki/anki-run-summary";
import { Button } from "../ui";
import { api } from "@/lib/api";
import { outcomeLines } from "@/lib/anki-outcomes";
import { changeSummary } from "@/lib/anki-sync-status";
import type { AnkiDeckChoice, AnkiRun } from "@/lib/anki-types";

const OFFER_HIDDEN = "anki-offer-hidden";
const offerListeners = new Set<() => void>();

function offerHidden(): boolean {
  try {
    return localStorage.getItem(OFFER_HIDDEN) === "1";
  } catch {
    return false;
  }
}

function hideOffer() {
  try {
    localStorage.setItem(OFFER_HIDDEN, "1");
  } catch {
    return;
  } finally {
    offerListeners.forEach((listener) => listener());
  }
}

function subscribeOffer(listener: () => void) {
  offerListeners.add(listener);
  return () => {
    offerListeners.delete(listener);
  };
}

const settingsLink = <Link href="/settings/anki" className="underline">Settings → Anki</Link>;

function AnkiOffer() {
  const hidden = useSyncExternalStore(subscribeOffer, offerHidden, () => true);
  if (hidden) return null;
  return (
    <p data-testid="anki-offer" className="mb-4 flex items-center gap-2 text-sm text-muted">
      Review in Anki? <Link href="/settings/anki" className="underline">Connect it</Link>
      <button type="button" onClick={hideOffer} aria-label="Hide" className="rounded px-1 hover:text-ink">✕</button>
    </p>
  );
}

type Times = ReturnType<typeof useSyncTimes>;

function StatusLine({ sync, times, latest }: { sync: AnkiSyncState; times: Times; latest: AnkiRun | null }) {
  const { progress } = sync;
  if (progress) return <span role="status">Syncing with Anki…{progress.total ? ` ${progress.done} / ${progress.total}` : ""}</span>;
  if (sync.problem === "unreachable") {
    return <>Anki isn&apos;t open. Open Anki desktop and it&apos;ll sync within 15 min{latest ? ` · Last ${times.synced}` : ""}</>;
  }
  return <>Anki · {times.synced}{times.next ? ` · ${times.next}` : ""}</>;
}

function Notes({ sync, latest, waiting }: { sync: AnkiSyncState; latest: AnkiRun | null; waiting: number }) {
  return (
    <>
      {sync.problem === "busy" && <p>A sync is already running, perhaps in another tab. Try again in a moment.</p>}
      {sync.problem === "failed" && <p>The sync didn&apos;t finish. Try again in a moment.</p>}
      {!sync.progress && latest?.state === "stopped" && <p>Sync stopped: Anki closed. The next sync carries on.</p>}
      {waiting > 0 && <p className="text-muted">A new deck needs its first sync in {settingsLink}.</p>}
    </>
  );
}

function Changes({ run }: { run: AnkiRun }) {
  const summary = changeSummary(run);
  if (!summary) return null;
  return (
    <details data-testid="anki-changes">
      <summary className="cursor-pointer">{summary}</summary>
      <div className="mt-2 space-y-1">{outcomeLines(run, false).map((l) => <AnkiOutcomeWords key={l.outcome} run={run} line={l} />)}</div>
    </details>
  );
}

function ComputerStatus({ decks, latest }: { decks: AnkiDeckChoice[]; latest: AnkiRun | null }) {
  const sync = useAnkiSync();
  const times = useSyncTimes(latest);
  const synced = decks.filter((d) => d.firstSyncedAt).length;
  if (!synced) return <p>Preview and run your first Anki sync in {settingsLink}.</p>;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="flex-1"><StatusLine sync={sync} times={times} latest={latest} /></p>
        <Button variant="secondary" onClick={() => void syncAnki(true)} disabled={sync.progress !== null}>Sync now</Button>
      </div>
      <Notes sync={sync} latest={latest} waiting={decks.length - synced} />
      {latest && latest.state !== "running" && !sync.progress && <Changes key={latest.id} run={latest} />}
    </>
  );
}

function PhoneStatus({ latest }: { latest: AnkiRun | null }) {
  const { synced } = useSyncTimes(latest);
  return <p>Anki syncs from your computer · {latest ? `last ${synced}` : "not synced yet"}</p>;
}

function AnkiSyncBar({ fine }: { fine: boolean }) {
  const [decks, setDecks] = useState<AnkiDeckChoice[] | null>(null);
  const [latest] = useLatestAnkiRun();
  useEffect(() => {
    let cancelled = false;
    api<{ decks: AnkiDeckChoice[] }>("anki/decks").then((r) => !cancelled && setDecks(r.decks)).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);
  if (!decks?.length) return null;
  return (
    <div data-testid="anki-bar" className="mb-4 space-y-2 rounded-xl border border-line bg-card px-4 py-3 text-sm">
      {fine ? <ComputerStatus decks={decks} latest={latest} /> : <PhoneStatus latest={latest} />}
    </div>
  );
}

export function AnkiBar() {
  const { me } = useMe();
  const fine = useFinePointer();
  if (!me.ankiConnected) return fine ? <AnkiOffer /> : null;
  return <AnkiSyncBar fine={fine} />;
}
