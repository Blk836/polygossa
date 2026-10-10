"use client";

import { useCallback, useState } from "react";
import { readerSettingsCookie, type ReaderSettings } from "./reader-settings";

export function useReaderSettings(initial: ReaderSettings) {
  const [settings, setSettings] = useState(initial);
  const update = useCallback((change: Partial<ReaderSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...change };
      document.cookie = readerSettingsCookie(next);
      return next;
    });
  }, []);
  return { settings, update };
}
