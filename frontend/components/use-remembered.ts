"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { errorMessage } from "@/lib/api";
import { pageCache } from "@/lib/page-cache";

type Fetched<T> = { key: string | null; data: T | null };

const recall = <T>(key: string | null) => (key === null ? undefined : pageCache.recall<T>(key));

/**
 * A page's data, loaded by `load` and remembered under `key` (which must name everything the data depends on, such
 * as the language and filters; null loads nothing). A page seen before shows its last data at once while it
 * refreshes; until the first answer for a new key, the previous key's data stays (or null when there is none).
 * Changes made through `setData` are remembered too, so the next visit doesn't bring back what the learner just
 * removed. Lives in this browser tab's memory only (docs/acceptance/instant-tabs.feature).
 */
export function useRemembered<T>(key: string | null, load: () => Promise<T>) {
  const [fetched, setFetched] = useState<Fetched<T>>(() => ({ key, data: recall<T>(key) ?? null }));
  const [error, setError] = useState<string | null>(null);
  const loadNow = useEffectEvent(load);

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    loadNow()
      .then((data) => {
        if (cancelled) return;
        pageCache.remember(key, data);
        setFetched({ key, data });
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [key]);

  const current = (f: Fetched<T>) => (f.key === key ? f.data : (recall<T>(key) ?? f.data));
  const setData = (change: (data: T | null) => T | null) =>
    setFetched((f) => {
      const data = change(current(f));
      if (key !== null && data !== null) pageCache.remember(key, data);
      return { key, data };
    });

  return { data: key === null ? null : current(fetched), setData, error, setError };
}
