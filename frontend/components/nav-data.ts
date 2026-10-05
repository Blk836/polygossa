"use client";

import { useEffect, useState } from "react";
import { query } from "@/components/review/review-query";
import { api } from "@/lib/api";
import type { HeaderStats } from "@/lib/header-stats";
import type { ReviewStats } from "@/lib/types";

/** How often the streak flame burns down while a page stays open. */
const TICK_MS = 30_000;

/**
 * Cards due for review (words and sentences), for the Practice badge. Fetched again on every page change, so it
 * follows reviews and newly saved words. Null while loading or when stats aren't available (e.g. the plan lacks SRS).
 */
export function useDueCount(language: string, pathname: string): number | null {
  const [due, setDue] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<ReviewStats>(`review/stats${query(language)}`)
      .then((s) => !cancelled && setDue(s.dueWords + s.dueSentences))
      .catch(() => !cancelled && setDue(null));
    return () => {
      cancelled = true;
    };
  }, [language, pathname]);
  return due;
}

/**
 * Known words and the streak, fetched again on every page change. `secondsLeftToday` counts down while the page stays
 * open; at midnight the stats are fetched afresh, since an unpractised day ends the streak. Null when unavailable.
 */
export function useHeaderStats(language: string, pathname: string): HeaderStats | null {
  const [loaded, setLoaded] = useState<{ stats: HeaderStats; at: number } | null>(null);
  const [now, setNow] = useState(0);
  const [day, setDay] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<HeaderStats>(`dashboard/header${query(language)}`)
      .then((stats) => {
        if (cancelled) return;
        const at = Date.now();
        setLoaded({ stats, at });
        setNow(at);
      })
      .catch(() => !cancelled && setLoaded(null));
    return () => {
      cancelled = true;
    };
  }, [language, pathname, day]);

  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (loaded.stats.secondsLeftToday - (t - loaded.at) / 1000 <= 0) setDay((d) => d + 1);
    }, TICK_MS);
    return () => clearInterval(id);
  }, [loaded]);

  if (!loaded) return null;
  const elapsed = Math.max(Math.floor((now - loaded.at) / 1000), 0);
  return { ...loaded.stats, secondsLeftToday: Math.max(loaded.stats.secondsLeftToday - elapsed, 0) };
}
