"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/components/me-context";
import { Button, ErrorNote, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { cardIds, cardsInfo, deckNames, fieldNames, type AnkiCardInfo } from "@/lib/anki-connect";
import { exampleWords, suggestSetup } from "@/lib/anki-decks";
import type { AnkiDeckChoice } from "@/lib/anki-types";
import { LEARNING_LANGUAGES } from "@/lib/languages";
import type { LanguageCode } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  ticked: boolean;
  fields: string[];
  sample: AnkiCardInfo[];
  wordField: string;
  meaningField?: string;
  language: LanguageCode;
  fromExport: boolean;
}

async function sampleOf(deckId: number): Promise<AnkiCardInfo[]> {
  const ids = await cardIds(deckId);
  return ids.length ? cardsInfo(ids.slice(0, 3)) : [];
}

function rowOf(deck: { id: number; name: string }, sample: AnkiCardInfo[], chosen: AnkiDeckChoice | undefined, fallback: LanguageCode): Row {
  const base = { id: deck.id, name: deck.name, sample, fields: sample[0] ? fieldNames(sample[0]) : [] };
  const suggested = suggestSetup(sample, fallback);
  if (chosen) {
    const { wordField, meaningField, language } = chosen;
    return { ...base, ticked: true, wordField, meaningField, language, fromExport: suggested?.fromExport ?? false };
  }
  if (suggested) return { ...base, ticked: false, ...suggested };
  return { ...base, ticked: false, wordField: "", language: fallback, fromExport: false };
}

async function loadRows(saved: AnkiDeckChoice[], fallback: LanguageCode): Promise<Row[]> {
  const decks = await deckNames();
  return Promise.all(decks.map(async (d) => rowOf(d, await sampleOf(d.id), saved.find((s) => s.ankiDeckId === d.id), fallback)));
}

function DeckRow({ row, onChange }: { row: Row; onChange: (row: Row) => void }) {
  const empty = !row.fields.length;
  return (
    <li className="rounded-lg border border-line p-3" data-testid="anki-deck">
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={row.ticked} disabled={empty} onChange={(e) => onChange({ ...row, ticked: e.target.checked })} />
        {row.name}
        {row.fromExport && <span className="text-xs font-normal text-muted">exported from this app</span>}
        {empty && <span className="text-xs font-normal text-muted">no cards</span>}
      </label>
      {row.ticked && (
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
          <label>Word field
            <select aria-label="Word field" className={selectClass} value={row.wordField} onChange={(e) => onChange({ ...row, wordField: e.target.value })}>
              {row.fields.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label>Meaning field
            <select aria-label="Meaning field" className={selectClass} value={row.meaningField ?? ""} onChange={(e) => onChange({ ...row, meaningField: e.target.value || undefined })}>
              <option value="">None</option>
              {row.fields.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <label>Language
            <select aria-label="Language" className={selectClass} value={row.language} onChange={(e) => onChange({ ...row, language: e.target.value as LanguageCode })}>
              {LEARNING_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
          <p className="text-muted sm:col-span-3" data-testid="anki-examples">Examples: {exampleWords(row.sample, row.wordField).join(", ") || "none"}</p>
        </div>
      )}
    </li>
  );
}

export function AnkiDeckPicker({ saved, onSaved }: { saved: AnkiDeckChoice[]; onSaved: (decks: AnkiDeckChoice[]) => void }) {
  const { me, setMe } = useMe();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fallback = me.targetLanguage ?? "es";

  useEffect(() => {
    let cancelled = false;
    loadRows(saved, fallback).then((r) => !cancelled && setRows(r)).catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [saved, fallback]);

  async function save() {
    setError(null);
    const decks = (rows ?? []).filter((r) => r.ticked).map((r) => ({ ankiDeckId: r.id, name: r.name, language: r.language, wordField: r.wordField, meaningField: r.meaningField }));
    try {
      const result = await api<{ decks: AnkiDeckChoice[] }>("anki/decks", { method: "PUT", body: { decks } });
      setMe({ ...me, ankiConnected: result.decks.length > 0 });
      setDone(true);
      onSaved(result.decks);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  if (!rows) return error ? <ErrorNote message={error} /> : <p className="text-sm text-muted">Reading your decks…</p>;
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Your decks</h3>
      <ul className="space-y-2">
        {rows.map((row) => <DeckRow key={row.id} row={row} onChange={(next) => { setDone(false); setRows(rows.map((r) => (r.id === next.id ? next : r))); }} />)}
      </ul>
      <ErrorNote message={error} />
      <div className="flex items-center gap-3">
        <Button onClick={save}>Save decks</Button>
        {done && <span className="text-sm text-muted" role="status">Saved</span>}
      </div>
    </div>
  );
}
