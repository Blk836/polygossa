"use client";

import { useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { DictionaryResult, LanguageCode, WordLookup, WordStatus } from "@/lib/types";
import { useMe } from "../me-context";
import { UpgradeNote } from "../ui";
import type { TextAround } from "./reader-text";
import { AiExplanation, DictionaryLinks, ExtraActions, Meanings, PopupHeader, StatusButtons, type SentenceState } from "./popup-parts";

const lookupCache = new Map<string, Promise<WordLookup>>();

/**
 * The word's meanings in the learner's language, kept for the page's life per word and native language. The text
 * around it lets the backend ask a word Amazon gives back unchanged inside its sentence (translation-in-context.feature).
 */
function lookup(language: LanguageCode, term: string, nativeLanguage: string, around: TextAround): Promise<WordLookup> {
  const key = `${nativeLanguage}:${language}:${term}`;
  let p = lookupCache.get(key);
  if (!p) {
    const params = new URLSearchParams({ language, term });
    if (around.before) params.set("before", around.before);
    if (around.after) params.set("after", around.after);
    p = api<WordLookup>(`dictionary?${params}`);
    p.catch(() => lookupCache.delete(key));
    lookupCache.set(key, p);
  }
  return p;
}

export interface PopupTarget {
  kind: "word" | "phrase";
  term: string; // normalized lookup key
  display: string; // as written in the text
  reading?: string;
  sentence: string;
  /** The sentence's text before and after it. */
  around: TextAround;
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
  /** The lookup finished: a word saved by opening the popup keeps its meaning. */
  onLookup: (lookup: WordLookup) => void;
  /** The learner picked another own-language meaning for the word. */
  onPickMeaning: (meaning: string) => void;
  onSaveSentence: (translation?: string) => Promise<void>;
  onPlayFromHere: () => void;
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
  const { target, language, onLookup } = props;
  const { me } = useMe();
  const [result, setResult] = useState<WordLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<DictionaryResult | null>(null);
  const [aiExample, setAiExample] = useState<{ sentence: string; translation: string } | null>(null);
  const [translation, setTranslation] = useState<string | null>(null);
  const [sentenceState, setSentenceState] = useState<SentenceState>("idle");
  const ai = useAiAction();

  useEffect(() => {
    let cancelled = false;
    lookup(language, target.kind === "word" ? target.display : target.term, me.nativeLanguage, target.around)
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        onLookup(r);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [language, target, onLookup, me.nativeLanguage]);

  function explain() {
    const params = new URLSearchParams({ language, term: target.display, context: target.sentence.slice(0, 300) });
    void ai.run(() => api<DictionaryResult>(`dictionary/explain?${params}`), setExplanation);
  }

  function generateExample() {
    const params = new URLSearchParams({ language, term: target.display });
    const meaning = result?.meanings[0];
    if (meaning) params.set("definition", meaning);
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
      <PopupHeader target={target} speechLocale={props.speechLocale} onClose={props.onClose} />
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        <Meanings lookup={result} error={error} onPick={props.onPickMeaning} />
        <DictionaryLinks language={language} nativeLanguage={me.nativeLanguage} term={target.display} />
        {explanation && <AiExplanation result={explanation} />}
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
          onExplain={explain}
          onTranslate={translateSentence}
          onExample={generateExample}
          onPlay={props.hasAudio ? props.onPlayFromHere : null}
        />
      </div>
    </div>
  );
}
