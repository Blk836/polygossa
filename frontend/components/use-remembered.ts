"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { errorMessage } from "@/lib/api";
import { pageCache } from "@/lib/page-cache";

type Fetched<T> = { key: string | null; data: T | null };

const recall = <T>(key: string | null) => (key === null ? undefined : pageCache.recall<T>(key));

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
