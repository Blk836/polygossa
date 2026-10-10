"use client";

import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { CATEGORIES } from "@/lib/categories";
import { INTEREST_MINIMUM } from "@/lib/recommendations";
import type { Category } from "@/lib/types";
import { Button, ErrorNote } from "./ui";

export function InterestPicker() {
  const [picked, setPicked] = useState<Category[]>([]);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toggle = (code: Category) => {
    setSaved(false);
    setPicked((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  };

  async function save() {
    setError(null);
    try {
      const order = CATEGORIES.map((c) => c.code);
      const categories = [...picked].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      await api("recommendations/interests", { method: "PUT", body: { categories } });
      setSaved(true);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div role="group" aria-labelledby="interests-heading" className="mt-6 rounded-xl border border-line bg-card p-4">
      <h2 id="interests-heading" className="font-semibold">What do you like?</h2>
      <p className="mt-0.5 text-sm text-muted">Pick at least {INTEREST_MINIMUM} and Explore will recommend more of them.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {CATEGORIES.filter((c) => c.code !== "other").map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => toggle(c.code)}
            aria-pressed={picked.includes(c.code)}
            className={`rounded-full border px-3 py-1 text-sm transition ${
              picked.includes(c.code) ? "border-accent bg-accent-soft text-ink" : "border-line text-muted hover:border-accent/50 hover:text-ink"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button onClick={() => void save()} disabled={picked.length < INTEREST_MINIMUM}>Save interests</Button>
        {saved && <span className="text-sm text-good">Saved: we&apos;ll recommend more of these</span>}
      </div>
      <ErrorNote message={error} />
    </div>
  );
}
