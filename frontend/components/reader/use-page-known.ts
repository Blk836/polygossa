"use client";

import { useCallback } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Token, WordStatus } from "@/lib/types";
import { pageRange, pageTokens, unseenOnPage, type ReaderPage } from "./reader-pages";

interface Options {
  textId: number;
  statuses: Record<string, WordStatus>;
  /** Colours the given tokens' unseen words as known. */
  markRemainingKnown: (tokens: Token[]) => void;
  onSaved: () => void;
  onError: (message: string) => void;
}

/**
 * "Turning the page marks it known" (as in LingQ): the words on a page that still have no status become known.
 * Colours change once the server has saved them.
 */
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
