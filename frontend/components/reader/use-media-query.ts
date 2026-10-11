"use client";

import { useSyncExternalStore } from "react";

export const PHONE = "(max-width: 39.99rem)";
export const VIDEO_BESIDE = "(min-width: 64rem)";

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (change) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", change);
      return () => list.removeEventListener("change", change);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
