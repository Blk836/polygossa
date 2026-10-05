"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import { itemsLabel, nextUp, playlistReadHref, startLabel } from "@/lib/playlists";
import type { PlaylistDetail, PlaylistSummary } from "@/lib/playlist-types";
import { Button, ErrorNote, Field, LinkButton, inputClass } from "../ui";
import { SavePlaylistButton } from "./save-playlist";

/**
 * Title, description and progress, the Start / Continue button, and for the owner: edit, share, copy link, delete;
 * for everyone else: Save.
 */
export function PlaylistHeader({ detail, onChanged, onDeleted }: {
  detail: PlaylistDetail;
  onChanged: (p: PlaylistSummary) => void;
  onDeleted: () => void;
}) {
  const p = detail.playlist;
  const [editing, setEditing] = useState(false);
  const next = nextUp(detail.items);
  return (
    <div className="mb-6">
      <Link href="/playlists" className="text-sm text-muted hover:text-ink">← Playlists</Link>
      {editing ? (
        <EditForm playlist={p} onSaved={(s) => { onChanged(s); setEditing(false); }} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight" lang={p.language}>{p.title}</h1>
          {p.description && <p className="mt-2 max-w-2xl whitespace-pre-line text-muted">{p.description}</p>}
        </>
      )}
      <Meta playlist={p} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {next && <LinkButton href={playlistReadHref(next.id, p.id)}>{startLabel(detail.items)}</LinkButton>}
        {!p.mine && <SavePlaylistButton playlist={p} className="text-sm" />}
        {p.mine && !editing && <OwnerTools playlist={p} onChanged={onChanged} onDeleted={onDeleted} onEdit={() => setEditing(true)} />}
      </div>
      {p.mine && p.isPublic && <PrivateNote count={detail.privateItems} />}
    </div>
  );
}

function Meta({ playlist: p }: { playlist: PlaylistSummary }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-muted">
      <span>{languageName(p.language)} playlist</span>
      {!p.mine && <span>· by {p.owner.displayName}</span>}
      <span>· {itemsLabel(p)}</span>
      {p.mine && <span data-testid="playlist-status" className="rounded bg-accent-soft px-1.5 py-0.5 text-xs text-ink">{p.isPublic ? "Shared" : "Private"}</span>}
    </div>
  );
}

/** On a shared playlist: the owner's private items are left out for everyone else. */
function PrivateNote({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <p className="mt-3 text-sm text-warn">
      {count === 1 ? "1 item is private, so only you can see it" : `${count} items are private, so only you can see them`}
      {" "}— share them from your library to include them.
    </p>
  );
}

function OwnerTools({ playlist, onChanged, onDeleted, onEdit }: {
  playlist: PlaylistSummary;
  onChanged: (p: PlaylistSummary) => void;
  onDeleted: () => void;
  onEdit: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const share = () => run(async () => {
    onChanged(await api<PlaylistSummary>(`playlists/${playlist.id}`, { method: "PATCH", body: { isPublic: !playlist.isPublic } }));
  });
  const copy = () => run(async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/playlists/${playlist.id}`);
    setCopied(true);
  });
  const remove = () => run(async () => {
    if (!window.confirm(`Delete the playlist “${playlist.title}”? Its texts and videos stay in your library.`)) return;
    await api(`playlists/${playlist.id}`, { method: "DELETE" });
    onDeleted();
  });

  return (
    <>
      <Button variant="secondary" onClick={onEdit}>Edit</Button>
      <Button variant="secondary" onClick={() => void share()}>{playlist.isPublic ? "Make private" : "Share"}</Button>
      {playlist.isPublic && <Button variant="secondary" onClick={() => void copy()}>{copied ? "Link copied" : "Copy link"}</Button>}
      <Button variant="danger" onClick={() => void remove()}>Delete playlist</Button>
      {error && <div className="basis-full"><ErrorNote message={error} /></div>}
    </>
  );
}

function EditForm({ playlist, onSaved, onCancel }: {
  playlist: PlaylistSummary;
  onSaved: (p: PlaylistSummary) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(playlist.title);
  const [description, setDescription] = useState(playlist.description ?? "");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      onSaved(await api<PlaylistSummary>(`playlists/${playlist.id}`, { method: "PATCH", body: { title, description } }));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mt-3 max-w-2xl space-y-3 rounded-xl border border-line bg-card p-4">
      <Field label="Title"><input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} required /></Field>
      <Field label="Description">
        <textarea className={inputClass} rows={3} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
      </Field>
      <ErrorNote message={error} />
      <div className="flex gap-2">
        <Button type="submit">Save</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
