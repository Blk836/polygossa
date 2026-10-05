"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { ReviewCard, ReviewStats } from "@/lib/types";
import { RATING_KEYS, query, type Rating } from "./review-query";

export type { Rating } from "./review-query";

/** Loads the review queue and stats, and records ratings. Forgotten cards come back at the end of the session. */
export function useReviewSession(language: string, ahead: boolean) {
  const [queue, setQueue] = useState<ReviewCard[] | null>(null);
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<ReviewCard[]>(`review/queue${query(language, { limit: "50", ahead: String(ahead) })}`),
      api<ReviewStats>(`review/stats${query(language)}`),
    ])
      .then(([q, s]) => {
        if (cancelled) return;
        setQueue(q);
        setStats(s);
        setRevealed(false);
        setError(null);
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e : errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [language, ahead]);

  const card = queue?.[0];

  const rate = useCallback(
    async (rating: Rating) => {
      if (!card || busy) return;
      setBusy(true);
      try {
        const r = await api<{ stats: ReviewStats }>(`review/${card.type}/${card.id}${query(language)}`, {
          body: { rating },
        });
        setStats(r.stats);
        setQueue((q) => q && (rating === "forgot" ? [...q.slice(1), card] : q.slice(1)));
        setRevealed(false);
      } catch (e) {
        setError(e instanceof ApiError ? e : errorMessage(e));
      } finally {
        setBusy(false);
      }
    },
    [card, busy, language],
  );

  useEffect(() => {
    if (!card) return;
    const onKey = (e: KeyboardEvent) => {
      if (!revealed && e.code === "Space") {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      const rating = RATING_KEYS[e.key];
      if (revealed && rating) void rate(rating);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [card, revealed, rate]);

  return { queue, card, stats, revealed, reveal: () => setRevealed(true), error, busy, rate };
}
