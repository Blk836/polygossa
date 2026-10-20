"use client";

import { useEffect, useState } from "react";
import { query } from "@/components/review/review-query";
import { api } from "@/lib/api";
import type { HeaderStats } from "@/lib/header-stats";
import type { ReviewStats } from "@/lib/types";

const TICK_MS = 30_000;
const DUE_CHANGED_EVENT = "due-changed";

export function announceDue(dueWords: number) {
  window.dispatchEvent(new CustomEvent<number>(DUE_CHANGED_EVENT, { detail: dueWords }));
}

export function useDueCount(language: string, pathname: string, refreshed: unknown, canReview: boolean): number | null {
  const [due, setDue] = useState<number | null>(null);
  useEffect(() => {
    if (!canReview) return;
    let cancelled = false;
    api<ReviewStats>(`review/stats${query(language)}`)
      .then((s) => !cancelled && setDue(s.dueWords))
      .catch(() => !cancelled && setDue(null));
    return () => {
      cancelled = true;
    };
  }, [language, pathname, refreshed, canReview]);
  useEffect(() => {
    const onChange = (e: Event) => setDue((e as CustomEvent<number>).detail);
    window.addEventListener(DUE_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(DUE_CHANGED_EVENT, onChange);
  }, []);
  return canReview ? due : null;
}

export function useHeaderStats(language: string, pathname: string, refreshed: unknown): (HeaderStats & { language: string }) | null {
  const [loaded, setLoaded] = useState<{ stats: HeaderStats; at: number; language: string } | null>(null);
  const [now, setNow] = useState(0);
  const [day, setDay] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api<HeaderStats>(`dashboard/header${query(language)}`)
      .then((stats) => {
        if (cancelled) return;
        const at = Date.now();
        setLoaded({ stats, at, language });
        setNow(at);
      })
      .catch(() => !cancelled && setLoaded(null));
    return () => {
      cancelled = true;
    };
  }, [language, pathname, day, refreshed]);

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
  return { ...loaded.stats, language: loaded.language, secondsLeftToday: Math.max(loaded.stats.secondsLeftToday - elapsed, 0) };
}
