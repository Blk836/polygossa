"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import { savedMeaning } from "@/lib/dictionary";
import type { LanguageCode, TextDetail, Token, WordLookup, WordStatus } from "@/lib/types";
import type { PopupTarget } from "./word-popup";

type Phrase = TextDetail["phrases"][number];

interface Options {
  language: LanguageCode;
  textId: number;
  initialStatuses: Record<string, WordStatus>;
  initialPhrases: Phrase[];
  onSaved: () => void;
  onNotice: (message: string | null) => void;
  onError: (message: string) => void;
}

function withStatus(map: Record<string, WordStatus>, term: string, status: WordStatus | null) {
  const copy = { ...map };
  if (status) copy[term] = status;
  else delete copy[term];
  return copy;
}

function meaningFields(lookup: WordLookup | null): { meaning?: string; definition?: string } {
  const meaning = savedMeaning(lookup);
  return meaning ? { meaning, definition: meaning } : {};
}

export function useVocabularyStatus(opts: Options) {
  const { language, textId, onSaved, onNotice, onError } = opts;
  const [statuses, setStatuses] = useState(opts.initialStatuses);
  const [phrases, setPhrases] = useState(opts.initialPhrases);
  const statusesRef = useRef(statuses);
  const pending = useRef(new Map<string, Promise<unknown>>());
  const justCreated = useRef(new Set<string>());
  const lastLookup = useRef<WordLookup | null>(null);

  useEffect(() => {
    statusesRef.current = statuses;
  }, [statuses]);

  const save = useCallback(
    (term: string, body: Record<string, unknown>) => {
      const previous = pending.current.get(term) ?? Promise.resolve();
      const next = previous.catch(() => {}).then(() => api("vocabulary", { body: { language, term, textId, ...body } }));
      pending.current.set(term, next);
      return next;
    },
    [language, textId],
  );

  const reportFailure = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.upgradeRequired) onNotice(e.message);
      else onError(errorMessage(e));
    },
    [onNotice, onError],
  );

  const autoSave = useCallback(
    (token: Token, sentence: string) => {
      const term = token.normalized!;
      if (statusesRef.current[term]) return;
      setStatuses((s) => withStatus(s, term, "learning"));
      justCreated.current.add(term);
      save(term, { displayTerm: token.text, status: "learning", contextSentence: sentence })
        .then(onSaved)
        .catch((e) => {
          justCreated.current.delete(term);
          setStatuses((s) => withStatus(s, term, null));
          reportFailure(e);
        });
    },
    [save, onSaved, reportFailure],
  );

  const recordLookup = useCallback(
    (target: PopupTarget, lookup: WordLookup) => {
      lastLookup.current = lookup;
      if (target.kind !== "word" || !justCreated.current.delete(target.term)) return;
      const fields = meaningFields(lookup);
      if (!fields.meaning && !target.reading) return;
      void save(target.term, { ...fields, pronunciation: target.reading }).catch(() => {});
    },
    [save],
  );

  const statusOf = useCallback(
    (target: PopupTarget | null): WordStatus | undefined => {
      if (!target) return undefined;
      return target.kind === "word" ? statuses[target.term] : phrases.find((p) => p.term === target.term)?.status;
    },
    [statuses, phrases],
  );

  const apply = useCallback((target: PopupTarget, status: WordStatus | null) => {
    if (target.kind === "word") {
      setStatuses((prev) => withStatus(prev, target.term, status));
      return;
    }
    setPhrases((prev) => {
      const rest = prev.filter((p) => p.term !== target.term);
      return status ? [...rest, { term: target.term, status }] : rest;
    });
  }, []);

  const write = useCallback(
    async (target: PopupTarget, status: WordStatus | null, isNew: boolean) => {
      const { term } = target;
      if (status === null) {
        await (pending.current.get(term) ?? Promise.resolve()).catch(() => {});
        await api(`vocabulary/by-term?language=${language}&term=${encodeURIComponent(term)}`, { method: "DELETE" });
        return;
      }
      justCreated.current.delete(term);
      await save(term, {
        displayTerm: target.display,
        kind: target.kind,
        status,
        contextSentence: target.sentence,
        ...(isNew ? meaningFields(lastLookup.current) : {}),
      });
    },
    [language, save],
  );

  const pickMeaning = useCallback(
    async (target: PopupTarget, meaning: string) => {
      onNotice(null);
      const before = statusOf(target) ?? null;
      if (before === null) apply(target, "learning");
      try {
        await save(target.term, {
          displayTerm: target.display, kind: target.kind, contextSentence: target.sentence, meaning, definition: meaning,
        });
        onSaved();
      } catch (e) {
        if (before === null) apply(target, null);
        reportFailure(e);
      }
    },
    [onNotice, statusOf, apply, save, onSaved, reportFailure],
  );

  const setStatus = useCallback(
    async (target: PopupTarget, status: WordStatus | null) => {
      onNotice(null);
      const before = statusOf(target) ?? null;
      apply(target, status);
      try {
        await write(target, status, before === null);
        onSaved();
      } catch (e) {
        apply(target, before);
        reportFailure(e);
      }
    },
    [onNotice, statusOf, apply, write, onSaved, reportFailure],
  );

  const markRemainingKnown = useCallback((tokens: Token[]) => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const t of tokens) if (t.word && !next[t.normalized!]) next[t.normalized!] = "known";
      return next;
    });
  }, []);

  return { statuses, phrases, statusOf, autoSave, recordLookup, pickMeaning, setStatus, markRemainingKnown };
}
