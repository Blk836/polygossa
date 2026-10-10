"use client";

import { useCallback, useEffect, useState } from "react";
import { AnkiConnectStep, type Connection } from "./anki-connect-step";
import { AnkiDeckPicker } from "./anki-deck-picker";
import { AnkiHowItWorks } from "./anki-how-it-works";
import { AnkiSyncPanel } from "./anki-sync-panel";
import { useMe } from "@/components/me-context";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { connect } from "@/lib/anki-connect";
import type { AnkiDeckChoice } from "@/lib/anki-types";

const box = "space-y-3 rounded-xl border border-line bg-card p-5";

export function AnkiSettings() {
  const { me, setMe } = useMe();
  const [connection, setConnection] = useState<Connection>("idle");
  const [decks, setDecks] = useState<AnkiDeckChoice[] | null>(null);

  const loadDecks = useCallback(() => api<{ decks: AnkiDeckChoice[] }>("anki/decks").then((r) => setDecks(r.decks)), []);
  useEffect(() => {
    let cancelled = false;
    api<{ decks: AnkiDeckChoice[] }>("anki/decks").then((r) => !cancelled && setDecks(r.decks)).catch(() => !cancelled && setDecks([]));
    return () => {
      cancelled = true;
    };
  }, []);

  async function connectToAnki() {
    setConnection("connecting");
    setConnection((await connect()).kind);
  }

  async function disconnect() {
    await api("anki/decks", { method: "DELETE" });
    setMe({ ...me, ankiConnected: false });
    setDecks([]);
  }

  if (!decks) return <p className="text-sm text-muted">Loading…</p>;
  const synced = decks.some((d) => d.firstSyncedAt);
  return (
    <div className="space-y-4">
      <AnkiHowItWorks open={!synced} freePlan={me.plan.limits.savedWords !== null} />
      <div role="group" aria-label="Connect to Anki" className={box}>
        <h2 className="font-semibold">Anki</h2>
        <AnkiConnectStep connection={connection} onConnect={connectToAnki} onConnected={() => setConnection("granted")} />
        {connection === "granted" && <AnkiDeckPicker saved={decks} onSaved={setDecks} />}
      </div>
      {decks.length > 0 && (
        <div role="group" aria-label="Sync with Anki" className={box}>
          <AnkiSyncPanel decks={decks} onSynced={() => void loadDecks()} />
          <Button variant="secondary" onClick={disconnect}>Disconnect Anki</Button>
        </div>
      )}
    </div>
  );
}
