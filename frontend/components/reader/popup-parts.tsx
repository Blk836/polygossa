"use client";

import Link from "next/link";
import { useState } from "react";
import { canSpeak, speak } from "@/lib/speech";
import type { DictionaryResult, WordStatus } from "@/lib/types";
import { CloseIcon, PlayIcon, SpeakerIcon } from "../icons";
import { Spinner } from "../ui";
import type { PopupTarget } from "./word-popup";

const STATUS_BUTTONS: { status: WordStatus; label: string; key: string; className: string }[] = [
  { status: "learning", label: "Learning", key: "L", className: "bg-learning" },
  { status: "known", label: "Known", key: "K", className: "bg-known" },
  { status: "ignored", label: "Ignore", key: "I", className: "bg-ignored" },
];

const iconButton = "rounded-lg p-1.5 text-muted hover:bg-paper hover:text-ink";
const actionButton = "rounded-lg border border-line px-2.5 py-1.5 hover:bg-paper";

export function PopupHeader({ target, result, speechLocale, onLookupLemma, onClose }: {
  target: PopupTarget;
  result: DictionaryResult | null;
  speechLocale: string;
  onLookupLemma: (lemma: string) => void;
  onClose: () => void;
}) {
  const showReading = !!target.reading && target.reading !== target.display;
  const lemma = result?.lemma;
  return (
    <div className="flex items-start gap-2 border-b border-line p-4 pb-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-reading text-xl font-semibold break-words">{target.display}</span>
          {showReading && <span className="text-sm text-muted">{target.reading}</span>}
          {result?.pronunciation && <span className="text-sm text-muted">{result.pronunciation}</span>}
        </div>
        {lemma && (
          <button onClick={() => onLookupLemma(lemma)} className="mt-0.5 text-xs text-accent underline">form of {lemma}</button>
        )}
        {target.kind === "phrase" && <span className="text-xs text-muted">Phrase</span>}
      </div>
      {canSpeak() && (
        <button onClick={() => speak(target.display, speechLocale)} className={iconButton} aria-label="Pronounce" title="Pronounce">
          <SpeakerIcon />
        </button>
      )}
      <button onClick={onClose} className={iconButton} aria-label="Close"><CloseIcon /></button>
    </div>
  );
}

/** Definitions (first three, expandable) and up to two dictionary examples. */
export function Senses({ result, error, isPro }: { result: DictionaryResult | null; error: string | null; isPro: boolean }) {
  const [showAll, setShowAll] = useState(false);
  if (error) return <p className="text-danger">{error}</p>;
  if (!result) return <Spinner className="text-muted" />;
  if (!result.found) {
    return <p className="text-muted">No dictionary entry found. {!isPro && "Pro adds AI definitions for words the free dictionaries miss."}</p>;
  }
  const senses = result.senses;
  const visible = showAll ? senses : senses.slice(0, 3);
  const examples = senses.flatMap((s) => s.examples).filter(Boolean).slice(0, 2);
  return (
    <>
      <ol className="space-y-1.5">
        {visible.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-muted">{i + 1}.</span>
            <span>{s.partOfSpeech && <em className="mr-1 text-muted">{s.partOfSpeech}</em>}{s.definition}</span>
          </li>
        ))}
      </ol>
      {senses.length > 3 && (
        <button className="text-xs text-accent underline" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Fewer meanings" : `${senses.length - 3} more meanings`}
        </button>
      )}
      {examples.map((ex, i) => (
        <p key={i} className="border-l-2 border-line pl-2 font-reading italic">{ex}</p>
      ))}
    </>
  );
}

export function Source({ result }: { result: DictionaryResult | null }) {
  if (!result?.source) return null;
  return (
    <p className="text-xs text-muted">
      Source:{" "}
      {result.sourceUrl ? <a href={result.sourceUrl} target="_blank" rel="noreferrer" className="underline">{result.source}</a> : result.source}
    </p>
  );
}

export function StatusButtons({ status, kind, onStatus }: {
  status: WordStatus | undefined;
  kind: PopupTarget["kind"];
  onStatus: (status: WordStatus | null) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {STATUS_BUTTONS.map((b) => (
        <button
          key={b.status}
          onClick={() => onStatus(b.status)}
          className={`rounded-lg px-2 py-2 text-xs font-medium transition ${
            status === b.status ? `${b.className} ring-2 ring-accent` : "border border-line hover:bg-paper"
          }`}
          title={`${b.label} (${b.key})`}
        >
          {b.label}
        </button>
      ))}
      <button
        onClick={() => onStatus(null)}
        disabled={!status}
        className="rounded-lg border border-line px-2 py-2 text-xs text-muted hover:bg-paper disabled:opacity-40"
        title="Remove from vocabulary (X)"
      >
        {kind === "phrase" ? "Remove" : "Unsave"}
      </button>
    </div>
  );
}

export type SentenceState = "idle" | "saving" | "saved";

const SENTENCE_LABELS: Record<SentenceState, string> = {
  idle: "Save sentence to review",
  saving: "Saving…",
  saved: "✓ Sentence saved",
};

/** Sentence mining, AI helpers (Pro) and "play from here" (when the text has synced audio). */
export function ExtraActions({ sentenceState, onSaveSentence, isPro, aiBusy, onTranslate, onExample, onPlay }: {
  sentenceState: SentenceState;
  onSaveSentence: () => void;
  isPro: boolean;
  aiBusy: boolean;
  onTranslate: () => void;
  onExample: () => void;
  /** Null when there is no synced audio. */
  onPlay: (() => void) | null;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <button onClick={onSaveSentence} disabled={sentenceState !== "idle"} className={`${actionButton} disabled:opacity-60`}>
        {SENTENCE_LABELS[sentenceState]}
      </button>
      {isPro ? (
        <>
          <button onClick={onTranslate} disabled={aiBusy} className={actionButton}>Translate sentence</button>
          <button onClick={onExample} disabled={aiBusy} className={actionButton}>{aiBusy ? "Thinking…" : "AI example"}</button>
        </>
      ) : (
        <Link href="/settings#plan" className="rounded-lg px-2.5 py-1.5 text-muted underline">AI examples with Pro</Link>
      )}
      {onPlay && (
        <button onClick={onPlay} className={`ml-auto flex items-center gap-1 ${actionButton}`}>
          <PlayIcon className="size-3" /> Play from here
        </button>
      )}
    </div>
  );
}
