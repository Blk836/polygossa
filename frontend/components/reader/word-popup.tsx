"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { hasDetails } from "@/lib/dictionary";
import type { DictionaryResult, LanguageCode, WordStatus } from "@/lib/types";
import { UpgradeNote } from "../ui";
import { ExtraActions, PopupHeader, Senses, Source, StatusButtons, type SentenceState } from "./popup-parts";

const dictionaryCache = new Map<string, Promise<DictionaryResult>>();

export function lookup(language: LanguageCode, term: string, context?: string): Promise<DictionaryResult> {
  const key = `${language}:${term}`;
  let p = dictionaryCache.get(key);
  if (!p) {
    const params = new URLSearchParams({ language, term });
    if (context) params.set("context", context.slice(0, 300));
    p = api<DictionaryResult>(`dictionary?${params}`);
    p.catch(() => dictionaryCache.delete(key));
    dictionaryCache.set(key, p);
  }
  return p;
}

export interface PopupTarget {
  kind: "word" | "phrase";
  term: string; // normalized lookup key
  display: string; // as written in the text
  reading?: string;
  sentence: string;
  startToken: number;
}

interface Props {
  target: PopupTarget;
  language: LanguageCode;
  speechLocale: string;
  status: WordStatus | undefined;
  isPro: boolean;
  notice: string | null;
  hasAudio: boolean;
  onStatus: (status: WordStatus | null) => void;
  onDefinition: (result: DictionaryResult) => void;
  /** The learner picked another own-language meaning for the word. */
  onPickMeaning: (meaning: string) => void;
  onSaveSentence: (translation?: string) => Promise<void>;
  onPlayFromHere: () => void;
  onLookupLemma: (lemma: string) => void;
  onClose: () => void;
}

/** Runs an AI request with a shared busy flag and error message. */
function useAiAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function run<T>(request: () => Promise<T>, onResult: (r: T) => void) {
    setBusy(true);
    setError(null);
    try {
      onResult(await request());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}

/** The lookup popup. State starts fresh per word: the reader remounts it (via key) for each new target. */
export function WordPopup(props: Props) {
  const { target, language, onDefinition } = props;
  const [result, setResult] = useState<DictionaryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiExample, setAiExample] = useState<{ sentence: string; translation: string } | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [sentenceState, setSentenceState] = useState<SentenceState>("idle");
  const ai = useAiAction();

  useEffect(() => {
    let cancelled = false;
    lookup(language, target.kind === "word" ? target.display : target.term, target.sentence)
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        if (hasDetails(r)) onDefinition(r);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [language, target, onDefinition]);

  function generateExample() {
    const params = new URLSearchParams({ language, term: target.display });
    const first = result?.senses[0];
    if (first) params.set("definition", first.definition);
    void ai.run(() => api<{ sentence: string; translation: string }>(`dictionary/example?${params}`), setAiExample);
  }

  function translateSentence() {
    void ai.run(
      () => api<{ translation: string }>("dictionary/translate", { body: { language, text: target.sentence } }),
      (r) => setTranslation(r.translation),
    );
  }

  async function saveSentence() {
    setSentenceState("saving");
    try {
      await props.onSaveSentence(translation ?? undefined);
      setSentenceState("saved");
    } catch {
      setSentenceState("idle");
    }
  }

  return (
    <div className="flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-xl sm:max-h-[28rem] sm:rounded-2xl">
      <PopupHeader target={target} result={result} speechLocale={props.speechLocale} onLookupLemma={props.onLookupLemma} onClose={props.onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        <Senses result={result} error={error} isPro={props.isPro} onPickMeaning={props.onPickMeaning} />
        {aiExample && (
          <div className="border-l-2 border-accent pl-2">
            <p className="font-reading italic">{aiExample.sentence}</p>
            <p className="text-xs text-muted">{aiExample.translation}</p>
          </div>
        )}
        <div className="rounded-lg bg-paper p-2.5">
          <p className="mb-1 text-xs font-medium text-muted">In this text</p>
          <p className="font-reading">{target.sentence}</p>
          {translation && <p className="mt-1 text-xs text-muted">{translation}</p>}
        </div>
        <Source result={result} />
        {ai.error && <p className="text-xs text-danger">{ai.error}</p>}
        {props.notice && <UpgradeNote message={props.notice} />}
      </div>
      <div className="space-y-2 border-t border-line p-3">
        <StatusButtons status={props.status} kind={target.kind} onStatus={props.onStatus} />
        <ExtraActions
          sentenceState={sentenceState}
          onSaveSentence={saveSentence}
          isPro={props.isPro}
          aiBusy={ai.busy}
          onTranslate={translateSentence}
          onExample={generateExample}
          onPlay={props.hasAudio ? props.onPlayFromHere : null}
        />
      </div>
    </div>
  );
}
