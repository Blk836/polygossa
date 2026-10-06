"use client";

import { useState } from "react";
import { Button, ErrorNote, inputClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import type { ForumPost } from "@/lib/forum";

/**
 * One forum post, shown exactly as typed (plain text, line breaks kept). Its author can edit it; its author and
 * admins can delete it, after an inline "Delete?" confirmation. Deleting a thread's first post deletes the thread.
 */
export function PostItem({ post, first, canDelete, onChanged, onDeleted }: {
  post: ForumPost;
  first: boolean;
  canDelete: boolean;
  onChanged: (post: ForumPost) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      onChanged(await api<ForumPost>(`forum/posts/${post.id}`, { method: "PATCH", body: { body: draft } }));
      setEditing(false);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function remove() {
    setError(null);
    try {
      await api(`forum/posts/${post.id}`, { method: "DELETE" });
      onDeleted();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <li data-testid="forum-post" className="p-4">
      <p className="text-xs text-muted">
        <span className="font-medium text-ink">{post.author.name}</span> · {new Date(post.createdAt).toLocaleString()}
        {post.editedAt && " · edited"}
      </p>
      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea aria-label="Edit post" className={`${inputClass} min-h-28`} value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={10000} />
          <div className="flex gap-2">
            <Button onClick={() => void save()}>Save</Button>
            <Button variant="secondary" onClick={() => { setEditing(false); setDraft(post.body); }}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap break-words">{post.body}</p>
      )}
      {!editing && (post.mine || canDelete) && (
        <div className="mt-2 flex items-center gap-3 text-sm">
          {post.mine && <button type="button" className="text-muted underline" onClick={() => setEditing(true)}>Edit</button>}
          {canDelete && <DeleteControl first={first} onDelete={() => void remove()} />}
        </div>
      )}
      <ErrorNote message={error} />
    </li>
  );
}

/** "Delete", then an inline confirmation instead of a browser dialog. */
function DeleteControl({ first, onDelete }: { first: boolean; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return <button type="button" className="text-muted underline" onClick={() => setConfirming(true)}>Delete</button>;
  }
  return (
    <span className="flex items-center gap-2">
      <span>{first ? "Delete the whole thread?" : "Delete this post?"}</span>
      <button type="button" className="text-bad underline" onClick={onDelete}>Yes, delete</button>
      <button type="button" className="text-muted underline" onClick={() => setConfirming(false)}>No</button>
    </span>
  );
}
