"use client";

import { useState } from "react";
import type { VocabularyEntry } from "@/lib/types";
import { Button, inputClass } from "../ui";
import { parseTags } from "./search";

/** The learner's own note and tags on a word: shown under its definition, edited in place; a tag filters the list. */
export function WordNotes({ entry, onSave, onTag }: {
  entry: VocabularyEntry;
  onSave: (body: { note: string; tags: string[] }) => Promise<boolean>;
  onTag: (tag: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState(entry.note ?? "");
  const [tags, setTags] = useState((entry.tags ?? []).join(", "));
  const has = !!entry.note || (entry.tags?.length ?? 0) > 0;

  async function save() {
    if (await onSave({ note, tags: parseTags(tags) })) setEditing(false);
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <label className="block text-xs text-muted">
          Note
          <textarea className={`${inputClass} mt-0.5`} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} autoFocus />
        </label>
        <label className="block text-xs text-muted">
          Tags
          <input className={`${inputClass} mt-0.5`} value={tags} placeholder="e.g. animals, a1" onChange={(e) => setTags(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <Button onClick={() => void save()}>Save note</Button>
          <button type="button" className="text-sm text-muted underline" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
      {entry.note && <p data-testid="word-note" className="w-full text-muted italic">{entry.note}</p>}
      {entry.tags?.map((t) => (
        <button key={t} type="button" onClick={() => onTag(t)} aria-label={`Tag ${t}`} title={`Show words tagged ${t}`}
          className="rounded-full border border-line px-2 py-0.5 text-xs hover:bg-paper">
          {t}
        </button>
      ))}
      <button type="button" onClick={() => setEditing(true)} className="text-xs text-muted underline">
        {has ? "Edit note and tags" : "Add a note or tags"}
      </button>
    </div>
  );
}
