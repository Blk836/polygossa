"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import { ankiBadgeText } from "@/lib/anki-sync-status";
import { NATIVE_LANGUAGES } from "@/lib/dictionary";
import { timesMetText } from "@/lib/times-met";
import { useMe } from "../me-context";
import type { VocabularyEntry, WordStatus } from "@/lib/types";
import { Button, FailureNote, chipSelectClass, inputClass } from "../ui";
import { WordNotes } from "./word-notes";

const STATUS_STYLE: Record<WordStatus, string> = {
  learning: "bg-learning",
  known: "bg-known",
  ignored: "bg-ignored",
};

function AnkiBadge({ entry }: { entry: VocabularyEntry }) {
  const tip = useId();
  if (!entry.anki) return null;
  return (
    <span tabIndex={0} data-testid="anki-badge" aria-describedby={tip} className="group relative rounded bg-line px-1.5 text-xs">
      Anki
      <span role="tooltip" id={tip}
        className="pointer-events-none invisible absolute left-0 top-full z-10 mt-1 w-max max-w-64 rounded-md border border-line bg-card px-2 py-1 shadow group-hover:visible group-focus:visible">
        {ankiBadgeText(entry.anki, entry.status)}
      </span>
    </span>
  );
}

function TermLine({ entry }: { entry: VocabularyEntry }) {
  const { me } = useMe();
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-reading text-lg font-semibold">{entry.displayTerm}</span>
      {entry.pronunciation && <span className="text-sm text-muted">{entry.pronunciation}</span>}
      {entry.partOfSpeech && <em className="text-sm text-muted">{entry.partOfSpeech}</em>}
      {entry.kind === "phrase" && <span className="rounded bg-line px-1.5 text-xs">phrase</span>}
      {entry.met && <span data-testid="times-met" className="text-xs text-muted" title="How many times you've met this in your reading">{timesMetText(entry.met)}</span>}
      {me.ankiConnected && <AnkiBadge entry={entry} />}
    </div>
  );
}

function DefinitionEditor({ definition, onSave }: { definition: string | undefined; onSave: (value: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(definition ?? "");
  if (!editing) {
    return (
      <button className="mt-1 text-left text-sm hover:underline" onClick={() => setEditing(true)} title="Edit definition">
        {definition || <span className="text-muted">Add a definition…</span>}
      </button>
    );
  }
  return (
    <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); onSave(value); setEditing(false); }}>
      <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Definition" autoFocus />
      <Button type="submit">Save</Button>
    </form>
  );
}

function MeaningEditor({ entry, onSave }: { entry: VocabularyEntry; onSave: (value: string) => Promise<boolean> }) {
  const { me } = useMe();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(entry.meaning ?? "");
  const code = entry.meaningLanguage ?? me.nativeLanguage;
  if (!entry.meaning && me.nativeLanguage === "en") return null;
  const label = `${NATIVE_LANGUAGES.find((l) => l.code === code)?.name ?? code} meaning`;
  if (!editing) {
    return (
      <p data-testid="word-meaning" className="mt-1 text-sm">
        <span className="mr-1.5 text-xs text-muted">{label}</span>
        <button className="text-left font-medium hover:underline" onClick={() => setEditing(true)} title={`Edit ${label.toLowerCase()}`}>
          {entry.meaning || <span className="font-normal text-muted">Add one…</span>}
        </button>
      </p>
    );
  }
  return (
    <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await onSave(value)) setEditing(false); }}>
      <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} aria-label={label} maxLength={200} autoFocus />
      <Button type="submit">Save meaning</Button>
    </form>
  );
}

function Context({ entry }: { entry: VocabularyEntry }) {
  const source = entry.sourceText;
  if (!entry.contextSentence) {
    if (!source || entry.kind !== "phrase") return null;
    return <p className="mt-2 text-sm text-muted">from <Link href={`/read/${source.id}`} className="underline">{source.title}</Link></p>;
  }
  return (
    <p className="mt-2 border-l-2 border-line pl-2 font-reading text-sm text-muted">
      {entry.contextSentence}
      {source && <> — <Link href={`/read/${source.id}`} className="underline">{source.title}</Link></>}
    </p>
  );
}

export function EntryRow({ entry, onChange, onDelete, onTag }: {
  entry: VocabularyEntry;
  onChange: (e: VocabularyEntry) => void;
  onDelete: () => void;
  onTag: (tag: string) => void;
}) {
  const [error, setError] = useState<ApiError | string | null>(null);

  async function patch(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    try {
      onChange(await api<VocabularyEntry>(`vocabulary/${entry.id}`, { method: "PATCH", body }));
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e : errorMessage(e));
      return false;
    }
  }

  return (
    <li className="rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <TermLine entry={entry} />
          <MeaningEditor entry={entry} onSave={(meaning) => patch({ meaning })} />
          <DefinitionEditor definition={entry.definition} onSave={(definition) => void patch({ definition })} />
          <WordNotes entry={entry} onSave={patch} onTag={onTag} />
          <Context entry={entry} />
        </div>
        <div className="flex items-center gap-1">
          <select value={entry.status} onChange={(e) => patch({ status: e.target.value })}
            className={`${chipSelectClass} ${STATUS_STYLE[entry.status]}`} aria-label="Status">
            <option value="learning">Learning</option>
            <option value="known">Known</option>
            <option value="ignored">Ignored</option>
          </select>
          <button onClick={onDelete} className="rounded-md px-2 py-1 text-sm text-muted hover:text-danger" aria-label="Delete">✕</button>
        </div>
      </div>
      {error && <div className="mt-2"><FailureNote error={error} /></div>}
    </li>
  );
}
