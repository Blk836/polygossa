"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import { savedDefinition } from "@/lib/dictionary";
import type { DictionaryResult, LanguageCode, TextDetail, Token, WordStatus } from "@/lib/types";
import type { PopupTarget } from "./word-popup";

type Phrase = TextDetail["phrases"][number];

interface Options {
  language: LanguageCode;
  textId: number;
  initialStatuses: Record<string, WordStatus>;
  initialPhrases: Phrase[];
  /** Called after any successful write (plan usage counters may have changed). */
  onSaved: () => void;
  /** Plan-limit message to show in the popup, or null to clear it. */
  onNotice: (message: string | null) => void;
  onError: (message: string) => void;
}

function withStatus(map: Record<string, WordStatus>, term: string, status: WordStatus | null) {
  const copy = { ...map };
  if (status) copy[term] = status;
  else delete copy[term];
  return copy;
}

function definitionFields(result: DictionaryResult) {
  return {
    definition: savedDefinition(result),
    partOfSpeech: result.senses[0]?.partOfSpeech || undefined,
    pronunciation: result.pronunciation ?? undefined,
  };
}

/**
 * Word and phrase statuses for the reader, with optimistic updates. Writes for the same term are serialized so a
 * details update never races the create that precedes it.
 */
export function useVocabularyStatus(opts: Options) {
  const { language, textId, onSaved, onNotice, onError } = opts;
  const [statuses, setStatuses] = useState(opts.initialStatuses);
  const [phrases, setPhrases] = useState(opts.initialPhrases);
  const statusesRef = useRef(statuses);
  const pending = useRef(new Map<string, Promise<unknown>>());
  const justCreated = useRef(new Set<string>());
  const lastResult = useRef<DictionaryResult | null>(null);

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

  /** Looking up an unseen word saves it as "learning" (the plan's auto-save behaviour). */
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

  /** Stores the dictionary definition on a word that was auto-saved by this lookup. */
  const recordDefinition = useCallback(
    (target: PopupTarget, result: DictionaryResult) => {
      lastResult.current = result;
      if (target.kind !== "word" || !justCreated.current.delete(target.term)) return;
      const fields = definitionFields(result);
      void save(target.term, {
        ...fields,
        pronunciation: target.reading ?? fields.pronunciation,
        example: result.senses.flatMap((s) => s.examples)[0] ?? undefined,
      }).catch(() => {});
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
      const r = lastResult.current;
      justCreated.current.delete(term);
      await save(term, {
        displayTerm: target.display,
        kind: target.kind,
        status,
        contextSentence: target.sentence,
        ...(isNew && r?.found ? definitionFields(r) : {}),
      });
    },
    [language, save],
  );

  /** Sets (or with null, removes) the status of the word or phrase in the popup. */
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

  /** After "finish lesson": every word without a status becomes known. */
  const markRemainingKnown = useCallback((tokens: Token[]) => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const t of tokens) if (t.word && !next[t.normalized!]) next[t.normalized!] = "known";
      return next;
    });
  }, []);

  return { statuses, phrases, statusOf, autoSave, recordDefinition, setStatus, markRemainingKnown };
}
