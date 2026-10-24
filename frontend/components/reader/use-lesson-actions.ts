"use client";

import { useCallback, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { LanguageCode, Token, WordLookup, WordStatus } from "@/lib/types";
import type { PopupTarget } from "./word-popup";

interface Options {
  target: PopupTarget | null;
  textId: number;
  language: LanguageCode;
  tokens: Token[];
  vocab: {
    setStatus: (target: PopupTarget, status: WordStatus | null) => Promise<unknown>;
    recordLookup: (target: PopupTarget, lookup: WordLookup) => void;
    pickMeaning: (target: PopupTarget, meaning: string) => Promise<unknown>;
    markRemainingKnown: (tokens: Token[]) => void;
  };
  completeSession: () => Promise<void>;
  refresh: () => Promise<unknown> | void;
  setError: (message: string | null) => void;
}

export function useLessonActions({ target, textId, language, tokens, vocab, completeSession, refresh, setError }: Options) {
  const [finished, setFinished] = useState<number | null>(null);
  const [finishing, setFinishing] = useState(false);
  const { setStatus: setVocabStatus, recordLookup, pickMeaning, markRemainingKnown } = vocab;

  const setStatus = useCallback(
    (status: WordStatus | null) => {
      if (target) void setVocabStatus(target, status);
    },
    [target, setVocabStatus],
  );
  const onLookup = useCallback(
    (lookup: WordLookup) => {
      if (target) recordLookup(target, lookup);
    },
    [target, recordLookup],
  );
  const onPickMeaning = useCallback(
    (meaning: string) => {
      if (target) void pickMeaning(target, meaning);
    },
    [target, pickMeaning],
  );
  const saveSentence = useCallback(
    async (translation?: string) => {
      if (!target) return;
      await api("vocabulary", { body: { language, term: target.sentence, kind: "phrase", definition: translation, textId } });
      void refresh();
    },
    [target, language, textId, refresh],
  );

  async function finish() {
    setFinishing(true);
    setError(null);
    try {
      const r = await api<{ markedKnown: number }>(`texts/${textId}/complete`, { method: "POST" });
      await completeSession();
      markRemainingKnown(tokens);
      setFinished(r.markedKnown);
      void refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setFinishing(false);
    }
  }

  return { setStatus, onLookup, onPickMeaning, saveSentence, finish, finished, finishing };
}
