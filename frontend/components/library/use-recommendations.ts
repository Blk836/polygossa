"use client";

import { useRemembered } from "../use-remembered";
import { api, errorMessage } from "@/lib/api";
import {
  impressionBatches,
  openEvent,
  recommendationsPath,
  withoutItem,
  type RecommendationFilters,
  type RecommendedShelf,
  type Recommendations,
  type ShelfId,
} from "@/lib/recommendations";
import type { TextSummary } from "@/lib/types";

function log(body: object) {
  void api("recommendations/events", { body: { ...body } }).catch(() => {});
}

function loadShelves(path: string): Promise<RecommendedShelf[]> {
  return api<Recommendations>(path)
    .then((r) => {
      impressionBatches(r.shelves).forEach(log);
      return r.shelves;
    })
    .catch(() => []);
}

export function useRecommendations(language: string, filters: RecommendationFilters, onError: (message: string) => void) {
  const path = recommendationsPath(language, filters);
  const { data: shelves, setData: setShelves } = useRemembered(path, () => loadShelves(path));

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
