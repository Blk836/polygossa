"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}
