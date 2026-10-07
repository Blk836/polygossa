"use client";

import { useState } from "react";
import { useMe } from "../me-context";
import { Button, ErrorNote } from "../ui";
import { api, errorMessage } from "@/lib/api";
import type { Me } from "@/lib/types";

/** Settings › Profile: replay the first-visit tours (lib/tours.ts), or turn them off. */
export function ToursSection() {
  const { me, setMe } = useMe();
  const [replayed, setReplayed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function turn(on: boolean) {
    setError(null);
    try {
      setMe(await api<Me>("me", { method: "PATCH", body: { tours: on } }));
      setReplayed(on);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div role="group" aria-label="Feature tours" className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Feature tours</h2>
      <p className="mt-0.5 text-sm text-muted">
        {replayed
          ? "Each page shows its tour again on your next visit."
          : me.tours.on
            ? "A few short tips the first time you open each page."
            : "Tours are off."}
      </p>
      <ErrorNote message={error} />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void turn(true)}>Show tours again</Button>
        {me.tours.on && <Button variant="secondary" onClick={() => void turn(false)}>Turn off tours</Button>}
      </div>
    </div>
  );
}
