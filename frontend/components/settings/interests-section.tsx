"use client";

import { useEffect, useState } from "react";
import { Button, ErrorNote, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import type { Category } from "@/lib/types";

const CHOICES = CATEGORIES.filter((c) => c.code !== "other");

export function InterestsSection() {
  const [picked, setPicked] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ categories: Category[] }>("recommendations/interests")
      .then((r) => !cancelled && setPicked(r.categories))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (code: Category) => {
    setSaved(false);
    setPicked((p) => (p ?? []).includes(code) ? (p ?? []).filter((c) => c !== code) : [...(p ?? []), code]);
  };

  async function save() {
    setError(null);
    setSaved(false);
    try {
      const order = CATEGORIES.map((c) => c.code);
      const categories = [...(picked ?? [])].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      await api("recommendations/interests", { method: "PUT", body: { categories } });
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div role="group" aria-label="Interests" className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Interests</h2>
      <p className="mt-0.5 text-sm text-muted">Explore recommends more of what you pick, alongside what you read.</p>
      {loadError ? (
        <p className="mt-3 text-sm text-danger">Your interests couldn&apos;t be loaded. Try again later.</p>
      ) : picked === null ? (
        <Spinner className="mt-3" />
      ) : (
        <>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHOICES.map((c) => (
              <button key={c.code} type="button" onClick={() => toggle(c.code)} aria-pressed={picked.includes(c.code)}
                className={`rounded-full border px-3 py-1 text-sm transition ${
                  picked.includes(c.code) ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:border-accent/50 hover:text-ink"
                }`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={() => void save()}>Save interests</Button>
            {saved && <span className="text-sm text-good">Saved</span>}
          </div>
          <ErrorNote message={error} />
        </>
      )}
    </div>
  );
}
