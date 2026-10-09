"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import type { PlaylistSummary } from "@/lib/playlist-types";
import type { TextSummary } from "@/lib/types";
import { PlaylistIcon } from "../icons";
import { Button, ErrorNote, Spinner, inputClass } from "../ui";

const LIST_BUTTON = "flex items-center rounded-md px-2 py-1 text-xs text-muted hover:bg-paper hover:text-ink";

/**
 * A playlist button for a text or video: a dialog with a tick box per playlist in the text's language (a text can be
 * in any number of them) and a field to start a new one with it.
 */
export function AddToPlaylist({ text, className = LIST_BUTTON }: {
  text: TextSummary;
  /** The button's look; cards use the default, the reader its own tool buttons. */
  className?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    dialog.current?.showModal();
    setError(null);
    try {
      setLists(await api<PlaylistSummary[]>(`playlists?language=${text.language}&textId=${text.id}`));
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const mark = (id: number, on: boolean) =>
    setLists((ls) => ls?.map((p) => (p.id === id ? { ...p, containsText: on } : p)) ?? null);

  async function toggle(p: PlaylistSummary, on: boolean) {
    mark(p.id, on);
    try {
      await api(`playlists/${p.id}/items/${text.id}`, { method: on ? "PUT" : "DELETE" });
    } catch (e) {
      mark(p.id, !on);
      setError(errorMessage(e));
    }
  }

  async function create(title: string) {
    const p = await api<PlaylistSummary>("playlists", { body: { title, language: text.language } });
    await api(`playlists/${p.id}/items/${text.id}`, { method: "PUT" });
    setLists((ls) => [{ ...p, itemCount: 1, containsText: true }, ...(ls ?? [])]);
  }

  return (
    <>
      <button
        type="button" onClick={() => void open()} aria-label="Add to playlist" title="Add to playlist"
        className={className}
      >
        <PlaylistIcon className="size-4" />
      </button>
      <dialog
        ref={dialog} aria-label="Add to playlist"
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
      >
        <div className="space-y-4 p-5 text-sm">
          <div>
            <h2 className="font-display text-xl font-semibold">Add to playlist</h2>
            <p className="truncate text-muted" lang={text.language}>{text.title}</p>
          </div>
          <ErrorNote message={error} />
          <Choices lists={lists} language={text.language} onToggle={(p, on) => void toggle(p, on)} />
          <NewPlaylist onCreate={create} onError={setError} />
          <div className="flex items-center justify-between border-t border-line pt-3">
            <Link href="/playlists" className="text-muted underline hover:text-ink">Manage playlists</Link>
            <Button type="button" onClick={() => dialog.current?.close()}>Done</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function Choices({ lists, language, onToggle }: {
  lists: PlaylistSummary[] | null;
  language: TextSummary["language"];
  onToggle: (p: PlaylistSummary, on: boolean) => void;
}) {
  if (lists === null) return <Spinner />;
  if (lists.length === 0) return <p className="text-muted">You have no {languageName(language)} playlists yet.</p>;
  return (
    <ul className="max-h-64 space-y-1 overflow-y-auto">
      {lists.map((p) => (
        <li key={p.id}>
          <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-paper">
            <input type="checkbox" className="accent-[var(--accent)]" checked={p.containsText ?? false} onChange={(e) => onToggle(p, e.target.checked)} />
            <span className="min-w-0 flex-1 truncate">{p.title}</span>
            {p.isPublic && <span className="text-xs text-muted">Shared</span>}
          </label>
        </li>
      ))}
    </ul>
  );
}

function NewPlaylist({ onCreate, onError }: { onCreate: (title: string) => Promise<void>; onError: (m: string) => void }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await onCreate(title.trim());
      setTitle("");
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="flex gap-2">
      <input
        className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)}
        placeholder="New playlist…" aria-label="New playlist" maxLength={120}
      />
      <Button type="submit" variant="secondary" disabled={busy || !title.trim()}>Create</Button>
    </form>
  );
}
