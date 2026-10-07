"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { VocabularyEntry, WordStatus } from "@/lib/types";
import { Button, FailureNote, chipSelectClass, inputClass } from "../ui";
import { WordNotes } from "./word-notes";

const STATUS_STYLE: Record<WordStatus, string> = {
  learning: "bg-learning",
  known: "bg-known",
  ignored: "bg-ignored",
};

function TermLine({ entry }: { entry: VocabularyEntry }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="font-reading text-lg font-semibold">{entry.displayTerm}</span>
      {entry.pronunciation && <span className="text-sm text-muted">{entry.pronunciation}</span>}
      {entry.partOfSpeech && <em className="text-sm text-muted">{entry.partOfSpeech}</em>}
      {entry.kind === "phrase" && <span className="rounded bg-line px-1.5 text-xs">phrase</span>}
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
    <div className="mt-2 flex gap-2">
      <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      <Button onClick={() => { onSave(value); setEditing(false); }}>Save</Button>
    </div>
  );
}

function Context({ entry }: { entry: VocabularyEntry }) {
  if (!entry.contextSentence) return null;
  const source = entry.sourceText;
  return (
    <p className="mt-2 border-l-2 border-line pl-2 font-reading text-sm text-muted">
      {entry.contextSentence}
      {source && <> — <Link href={`/read/${source.id}`} className="underline">{source.title}</Link></>}
    </p>
  );
}

/** One vocabulary entry: edit its definition, note, tags or status, or delete it. */
export function EntryRow({ entry, onChange, onDelete, onTag }: {
  entry: VocabularyEntry;
  onChange: (e: VocabularyEntry) => void;
  onDelete: () => void;
  onTag: (tag: string) => void;
}) {
  const [error, setError] = useState<ApiError | string | null>(null);

  /** True when saved; on failure the error is shown and false returned. */
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
