"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import {
  impressionBatches,
  openEvent,
  recommendationsPath,
  withoutItem,
  type RecommendedShelf,
  type Recommendations,
  type ShelfId,
} from "@/lib/recommendations";
import type { TextSummary } from "@/lib/types";

/** Logged without waiting: a lost event must never get in the learner's way. */
function log(body: object) {
  void api("recommendations/events", { body: { ...body } }).catch(() => {});
}

/**
 * Explore's personalised shelves for a language: loaded once (cards shown are logged as impressions), with "Not
 * interested" and open logging. They are extra: if they can't load, Explore just shows its category shelves.
 */
export function useRecommendations(language: string, onError: (message: string) => void) {
  const [shelves, setShelves] = useState<RecommendedShelf[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<Recommendations>(recommendationsPath(language))
      .then((r) => {
        if (cancelled) return;
        setShelves(r.shelves);
        impressionBatches(r.shelves).forEach(log);
      })
      .catch(() => !cancelled && setShelves([]));
    return () => {
      cancelled = true;
    };
  }, [language]);

  /** Applies a change to every recommended card (e.g. a like toggled elsewhere on the page). */
  const mapTexts = useCallback((change: (t: TextSummary) => TextSummary) => {
    setShelves((s) => s?.map((shelf) => ({ ...shelf, items: shelf.items.map((it) => ({ ...it, text: change(it.text) })) })) ?? null);
  }, []);

  async function notInterested(t: TextSummary) {
    setShelves((s) => s && withoutItem(s, t.id));
    try {
      await api(`recommendations/not-interested/${t.id}`, { method: "PUT" });
    } catch (e) {
      onError(errorMessage(e));
    }
  }

  function open(shelf: ShelfId, t: TextSummary, position: number) {
    log(openEvent(shelf, t.id, position));
  }

  return { shelves, mapTexts, notInterested, open };
}
