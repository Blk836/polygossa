"use client";

import { useCallback } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Token, WordStatus } from "@/lib/types";
import { pageRange, pageTokens, unseenOnPage, type ReaderPage } from "./reader-pages";

interface Options {
  textId: number;
  statuses: Record<string, WordStatus>;
  markRemainingKnown: (tokens: Token[]) => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

export function usePageKnown({ textId, statuses, markRemainingKnown, onSaved, onError }: Options) {
  return useCallback(
    (page: ReaderPage) => {
      const range = pageRange(page);
      if (!range || unseenOnPage(page, statuses) === 0) return;
      api(`texts/${textId}/mark-known`, { body: { fromToken: range.from, toToken: range.to } })
        .then(() => {
          markRemainingKnown(pageTokens(page));
          onSaved();
        })
        .catch((e) => onError(errorMessage(e)));
    },
    [textId, statuses, markRemainingKnown, onSaved, onError],
  );
}
