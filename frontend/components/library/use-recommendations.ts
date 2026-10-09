"use client";

import { useRemembered } from "../use-remembered";
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

/** The shelves, logging the cards shown as impressions; none when they can't load (they are extra). */
function loadShelves(language: string): Promise<RecommendedShelf[]> {
  return api<Recommendations>(recommendationsPath(language))
    .then((r) => {
      impressionBatches(r.shelves).forEach(log);
      return r.shelves;
    })
    .catch(() => []);
}

/**
 * Explore's personalised shelves for a language, with "Not interested" and open logging. Remembered like the page's
 * other rows, so a return visit shows them at once while they refresh. They are extra: if they can't load, Explore
 * just shows its category shelves. `shelves` is null until the first answer.
 */
export function useRecommendations(language: string, onError: (message: string) => void) {
  const { data: shelves, setData: setShelves } = useRemembered(`recommendations:${language}`, () => loadShelves(language));

  /** Applies a change to every recommended card (e.g. a like toggled elsewhere on the page). */
  const mapTexts = (change: (t: TextSummary) => TextSummary) => {
    setShelves((s) => s?.map((shelf) => ({ ...shelf, items: shelf.items.map((it) => ({ ...it, text: change(it.text) })) })) ?? null);
  };

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
