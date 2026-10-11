"use client";

import { useEffect, useState } from "react";
import { NoteTypeRow } from "./anki-note-type-row";
import { useMe } from "@/components/me-context";
import { Button, ErrorNote, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { cardIds, cardsInfo, deckNames, fieldNames, noteTypesInDeck } from "@/lib/anki-connect";
import { decksTitle, suggestSetup } from "@/lib/anki-decks";
import { setupFor, toChoice as toNoteTypeChoice, type NoteTypeSetup } from "@/lib/anki-note-types";
import type { AnkiDeckChoice } from "@/lib/anki-types";
import { LEARNING_LANGUAGES } from "@/lib/languages";
import type { LanguageCode } from "@/lib/types";

interface Row {
  id: number;
  name: string;
  cards: number;
  ticked: boolean;
  language: LanguageCode;
  fromExport: boolean;
  noteTypes: NoteTypeSetup[] | null;
}

async function rowOf(deck: { id: number; name: string }, saved: AnkiDeckChoice | undefined, fallback: LanguageCode): Promise<Row> {
  const ids = await cardIds(deck.id);
  const suggested = suggestSetup(ids.length ? await cardsInfo(ids.slice(0, 1)) : [], fallback);
  const language = saved?.language ?? suggested?.language ?? fallback;
  return { id: deck.id, name: deck.name, cards: ids.length, ticked: !!saved, language, fromExport: suggested?.fromExport ?? false, noteTypes: null };
}

async function noteTypesOf(deckId: number, saved: AnkiDeckChoice | undefined): Promise<NoteTypeSetup[]> {
  const models = await noteTypesInDeck(deckId);
  return Promise.all(models.map(async (m) => {
    const sample = await cardsInfo(m.ids.slice(0, 3));
    return setupFor({ ...m, sample, fields: sample[0] ? fieldNames(sample[0]) : [] }, saved);
  }));
}

function toChoice(row: Row): AnkiDeckChoice {
  const types = row.noteTypes ?? [];
  const wordField = types.find((t) => !t.skip)?.wordField ?? types[0]?.wordField ?? "Front";
  return {
    ankiDeckId: row.id, name: row.name, language: row.language, wordField,
    noteTypes: types.map(toNoteTypeChoice),
  };
}

function DeckRow({ row, onChange }: { row: Row; onChange: (row: Row) => void }) {
  return (
    <li className="rounded-lg border border-line p-3" data-testid="anki-deck">
      <label className="flex items-center gap-2 font-medium">
        <input type="checkbox" checked={row.ticked} disabled={!row.cards} onChange={(e) => onChange({ ...row, ticked: e.target.checked })} />
        {row.name}
        {row.fromExport && <span className="text-xs font-normal text-muted">exported from this app</span>}
        {!row.cards && <span className="text-xs font-normal text-muted">no cards</span>}
      </label>
      {row.ticked && (
        <div className="mt-2 space-y-2 text-sm">
          <label className="block sm:w-1/2">Language
            <select aria-label="Language" className={selectClass} value={row.language} onChange={(e) => onChange({ ...row, language: e.target.value as LanguageCode })}>
              {LEARNING_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </label>
          {row.noteTypes ? (
            <ul className="space-y-2">
              {row.noteTypes.map((t) => <NoteTypeRow key={t.modelId} setup={t} onChange={(next) => onChange({ ...row, noteTypes: row.noteTypes!.map((x) => (x.modelId === next.modelId ? next : x)) })} />)}
            </ul>
          ) : <p className="text-muted">Reading its note types…</p>}
        </div>
      )}
    </li>
  );
}

export function AnkiDeckPicker({ saved, folded, onSaved }: { saved: AnkiDeckChoice[]; folded: boolean; onSaved: (decks: AnkiDeckChoice[]) => void }) {
  const { me, setMe } = useMe();
  const [open, setOpen] = useState(!folded);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fallback = me.targetLanguage ?? "es";

  useEffect(() => {
    let cancelled = false;
    deckNames()
      .then((decks) => Promise.all(decks.map((d) => rowOf(d, saved.find((s) => s.ankiDeckId === d.id), fallback))))
      .then((r) => !cancelled && setRows(r))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [saved, fallback]);

  const pending = rows?.find((r) => r.ticked && !r.noteTypes);
  useEffect(() => {
    if (!pending) return;
    let cancelled = false;
    noteTypesOf(pending.id, saved.find((s) => s.ankiDeckId === pending.id))
      .then((types) => {
        if (cancelled) return;
        if (types.some((t) => t.isNew)) setOpen(true);
        setRows((all) => all && all.map((r) => (r.id === pending.id ? { ...r, noteTypes: types } : r)));
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [pending, saved]);

  async function save() {
    setError(null);
    const decks = (rows ?? []).filter((r) => r.ticked && r.noteTypes).map(toChoice);
    try {
      const result = await api<{ decks: AnkiDeckChoice[] }>("anki/decks", { method: "PUT", body: { decks } });
      setMe({ ...me, ankiConnected: result.decks.length > 0 });
      setDone(true);
      onSaved(result.decks);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const body = rows ? (
    <div className="mt-3 space-y-3">
      <ul className="space-y-2">
        {rows.map((row) => <DeckRow key={row.id} row={row} onChange={(next) => { setDone(false); setRows(rows.map((r) => (r.id === next.id ? next : r))); }} />)}
      </ul>
      <ErrorNote message={error} />
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={!!pending}>Save decks</Button>
        {done && <span className="text-sm text-muted" role="status">Saved</span>}
      </div>
    </div>
  ) : error ? <ErrorNote message={error} /> : <p className="mt-3 text-sm text-muted">Reading your decks…</p>;

  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} data-testid="anki-decks">
      <summary className="cursor-pointer font-semibold">{decksTitle(saved)}</summary>
      {body}
    </details>
  );
}
