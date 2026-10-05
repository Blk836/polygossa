"use client";

import { api, errorMessage } from "@/lib/api";
import { chipSelectClass } from "@/components/ui";
import { CATEGORIES } from "@/lib/categories";
import type { Category, TextSummary } from "@/lib/types";

/** On your own items: file it under a category, share or unshare it, delete it. */
export function OwnerActions({ text, onChanged, onDeleted, onError }: {
  text: TextSummary;
  onChanged: (t: TextSummary) => void;
  onDeleted: (t: TextSummary) => void;
  onError: (message: string) => void;
}) {
  async function patch(body: { isPublic?: boolean; category?: Category }) {
    try {
      onChanged(await api<TextSummary>(`texts/${text.id}`, { method: "PATCH", body }));
    } catch (e) {
      onError(errorMessage(e));
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${text.title}”? Your saved words stay in your vocabulary.`)) return;
    try {
      await api(`texts/${text.id}`, { method: "DELETE" });
      onDeleted(text);
    } catch (e) {
      onError(errorMessage(e));
    }
  }

  const button = "rounded-md px-2 py-1 text-xs hover:bg-paper";
  return (
    <>
      <select
        className={`${chipSelectClass} max-w-36 bg-paper`}
        value={text.category}
        onChange={(e) => void patch({ category: e.target.value as Category })}
        aria-label="Category"
      >
        {CATEGORIES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
      </select>
      <button className={`${button} text-muted hover:text-ink`} onClick={() => void patch({ isPublic: !text.isPublic })}>
        {text.isPublic ? "Unshare" : "Share"}
      </button>
      <button className={`${button} ml-auto text-danger`} onClick={() => void remove()}>Delete</button>
    </>
  );
}
