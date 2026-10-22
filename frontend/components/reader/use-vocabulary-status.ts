"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import { savedMeaning, wordTypeLine } from "@/lib/dictionary";
import type { LanguageCode, TextDetail, Token, WordLookup, WordStatus } from "@/lib/types";
import type { PopupTarget } from "./word-popup";

type Phrase = TextDetail["phrases"][number];

interface Options {
  language: LanguageCode;
  textId: number;
  initialStatuses: Record<string, WordStatus>;
  initialPhrases: Phrase[];
  names: string[];
  onSaved: () => void;
  onKnownWord?: (target: PopupTarget, saved: boolean) => void;
  onNotice: (message: string | null) => void;
  onError: (message: string) => void;
}

function withStatus(map: Record<string, WordStatus>, term: string, status: WordStatus | null) {
  const copy = { ...map };
  if (status) copy[term] = status;
  else delete copy[term];
  return copy;
}

function withNames(statuses: Record<string, WordStatus>, names: Set<string>): Record<string, WordStatus> {
  if (names.size === 0) return statuses;
  const out: Record<string, WordStatus> = { ...statuses };
  for (const name of names) out[name] ??= "ignored";
  return out;
}

function meaningFields(lookup: WordLookup | null): { meaning?: string; definition?: string; partOfSpeech?: string } {
  const meaning = savedMeaning(lookup);
  if (!meaning) return {};
  const partOfSpeech = wordTypeLine(lookup?.wordType);
  return partOfSpeech ? { meaning, definition: meaning, partOfSpeech } : { meaning, definition: meaning };
}

function baseWord(target: PopupTarget, lookup: WordLookup | null): { lemma?: string } {
  if (target.kind !== "word" || !lookup?.wordType || lookup.term !== target.term) return {};
  return { lemma: lookup.wordType.lemma || target.term };
}

export function useVocabularyStatus(opts: Options) {
  const { language, textId, onSaved, onKnownWord, onNotice, onError } = opts;
  const [statuses, setStatuses] = useState(opts.initialStatuses);
  const [phrases, setPhrases] = useState(opts.initialPhrases);
  const statusesRef = useRef(statuses);
  const pending = useRef(new Map<string, Promise<unknown>>());
  const justCreated = useRef(new Set<string>());
  const lastLookup = useRef<WordLookup | null>(null);
  const names = useMemo(() => new Set(opts.names), [opts.names]);
  const shown = useMemo(() => withNames(statuses, names), [statuses, names]);

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
      if (statusesRef.current[term] || names.has(term)) return;
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
    [save, names, onSaved, reportFailure],
  );

  const recordLookup = useCallback(
    (target: PopupTarget, lookup: WordLookup) => {
      lastLookup.current = lookup;
      if (target.kind !== "word") return;
      const base = baseWord(target, lookup);
      if (!justCreated.current.delete(target.term)) {
        if (base.lemma && statusesRef.current[target.term]) void save(target.term, base).catch(() => {});
        return;
      }
      const fields = meaningFields(lookup);
      if (!fields.meaning && !target.reading && !base.lemma) return;
      void save(target.term, { ...fields, ...base, pronunciation: target.reading }).catch(() => {});
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
        ...(isNew ? { ...meaningFields(lastLookup.current), ...baseWord(target, lastLookup.current) } : {}),
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
      const newlyKnown = target.kind === "word" && status === "known" && before !== "known";
      if (newlyKnown) onKnownWord?.(target, false);
      apply(target, status);
      try {
        await write(target, status, before === null);
        if (newlyKnown) onKnownWord?.(target, true);
        onSaved();
      } catch (e) {
        apply(target, before);
        reportFailure(e);
      }
    },
    [onNotice, statusOf, apply, write, onKnownWord, onSaved, reportFailure],
  );

  const markRemainingKnown = useCallback((tokens: Token[]) => {
    setStatuses((prev) => {
      const next = { ...prev };
      for (const t of tokens) if (t.word && !next[t.normalized!] && !names.has(t.normalized!)) next[t.normalized!] = "known";
      return next;
    });
  }, [names]);

  return { statuses, shown, phrases, statusOf, autoSave, recordLookup, pickMeaning, setStatus, markRemainingKnown };
}
