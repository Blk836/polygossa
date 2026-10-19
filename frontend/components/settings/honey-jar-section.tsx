"use client";

import { useId, useState } from "react";
import { useMe } from "../me-context";
import { ErrorNote } from "../ui";
import { api, errorMessage } from "@/lib/api";
import type { HoneyJar } from "@/lib/header-stats";
import type { Me } from "@/lib/types";

const CHOICES: { value: HoneyJar; label: string; hint: string }[] = [
  { value: "all_forms", label: "All forms", hint: "Every form counts: go, goes and went are three words." },
  { value: "base_words", label: "Base words", hint: "Each word counts once, however many of its forms you know." },
];

export function HoneyJarSection() {
  const { me, setMe } = useMe();
  const heading = useId();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function choose(honeyJar: HoneyJar) {
    setError(null);
    setSaving(true);
    try {
      setMe(await api<Me>("me", { method: "PATCH", body: { honeyJar } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-labelledby={heading} className="rounded-xl border border-line bg-card p-5">
      <h2 id={heading} className="font-semibold">Honey jar</h2>
      <p className="mt-0.5 text-sm text-muted">Which number of known words the honey jar in the top bar shows.</p>
      <div role="radiogroup" aria-label="Honey jar" className="mt-3 grid gap-2">
        {CHOICES.map((c) => (
          <label key={c.value} className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="honey-jar"
              className="mt-0.5"
              checked={me.honeyJar === c.value}
              disabled={saving}
              onChange={() => void choose(c.value)}
            />
            <span>
              <span className="font-medium">{c.label}</span>
              <span className="block text-muted">{c.hint}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-3"><ErrorNote message={error} /></div>
    </section>
  );
}
