"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { SentenceCard } from "@/lib/types";
import { Empty, Spinner } from "../ui";

export function SentenceList({ language }: { language: string }) {
  const [items, setItems] = useState<SentenceCard[] | null>(null);
  useEffect(() => {
    const query = language ? `?language=${language}` : "";
    api<SentenceCard[]>(`sentences${query}`).then(setItems).catch(() => setItems([]));
  }, [language]);

  async function remove(id: number) {
    await api(`sentences/${id}`, { method: "DELETE" });
    setItems((list) => list && list.filter((x) => x.id !== id));
  }

  if (!items) return <Spinner />;
  if (!items.length) {
    return <Empty title="No saved sentences">Use “Save sentence to review” in the reader to mine phrases and grammar patterns.</Empty>;
  }
  return (
    <ul className="space-y-3">
      {items.map((s) => (
        <li key={s.id} className="flex gap-3 rounded-xl border border-line bg-card p-4">
          <div className="flex-1">
            <p className="font-reading">{s.sentence}</p>
            {s.translation && <p className="mt-1 text-sm text-muted">{s.translation}</p>}
            {s.sourceTextTitle && (
              <Link href={`/read/${s.sourceTextId}`} className="mt-1 inline-block text-xs text-muted underline">{s.sourceTextTitle}</Link>
            )}
          </div>
          <button className="self-start text-sm text-muted hover:text-danger" onClick={() => remove(s.id)} aria-label="Delete sentence">✕</button>
        </li>
      ))}
    </ul>
  );
}
