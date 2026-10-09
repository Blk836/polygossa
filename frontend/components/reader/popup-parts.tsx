"use client";

import Link from "next/link";
import { useState } from "react";
import { dictionaryLinks, meaningLine, meaningNote, savedMeaning } from "@/lib/dictionary";
import { canSpeak, speak } from "@/lib/speech";
import type { DictionaryResult, WordLookup, WordStatus } from "@/lib/types";
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

export function PopupHeader({ target, speechLocale, onClose }: {
  target: PopupTarget;
  speechLocale: string;
  onClose: () => void;
}) {
  const showReading = !!target.reading && target.reading !== target.display;
  return (
    <div className="flex items-start gap-2 border-b border-line p-4 pb-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-reading text-xl font-semibold break-words">{target.display}</span>
          {showReading && <span className="text-sm text-muted">{target.reading}</span>}
        </div>
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

export function Meanings({ lookup, error, onPick }: {
  lookup: WordLookup | null;
  error: string | null;
  onPick: (meaning: string) => void;
}) {
  const [chosen, setChosen] = useState(savedMeaning(lookup));
  if (error) return <p className="text-danger">{error}</p>;
  if (!lookup) return <Spinner className="text-muted" />;
  const line = meaningLine(lookup);
  if (!line) return null;
  if (line.missing) return <p data-testid="meanings" className="text-muted">{line.text}</p>;
  const note = meaningNote(lookup);
  return (
    <p data-testid="meanings" className="font-medium">
      <span className="mr-1.5 text-xs font-normal text-muted">{line.label}</span>
      {lookup.meanings.map((meaning, i) => (
        <span key={meaning}>
          {i > 0 && ", "}
          <button
            type="button"
            aria-pressed={meaning === (chosen ?? savedMeaning(lookup))}
            title="Keep this meaning with the word"
            onClick={() => {
              setChosen(meaning);
              onPick(meaning);
            }}
            className={`rounded px-0.5 ${meaning === (chosen ?? savedMeaning(lookup)) ? "bg-accent-soft text-ink" : "hover:bg-paper"}`}
          >
            {meaning}
          </button>
        </span>
      ))}
      {note && <span className="ml-1.5 text-xs font-normal text-muted">· {note}</span>}
    </p>
  );
}

export function DictionaryLinks({ language, nativeLanguage, term }: { language: string; nativeLanguage: string; term: string }) {
  return (
    <p data-testid="dictionary-links" className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
      {dictionaryLinks(language, nativeLanguage, term).map((link) => (
        <a key={link.name} href={link.url} target="_blank" rel="noreferrer" className="text-accent underline">{link.name}</a>
      ))}
    </p>
  );
}

export function AiExplanation({ result }: { result: DictionaryResult }) {
  if (!result.found) return <p data-testid="ai-explanation" className="text-muted">The AI couldn&apos;t explain this one.</p>;
  const example = result.senses.flatMap((s) => s.examples).find(Boolean);
  return (
    <div data-testid="ai-explanation" className="space-y-1.5 border-l-2 border-accent pl-2">
      <ol className="space-y-1">
        {result.senses.map((s, i) => (
          <li key={i}>{s.partOfSpeech && <em className="mr-1 text-muted">{s.partOfSpeech}</em>}{s.definition}</li>
        ))}
      </ol>
      {example && <p className="font-reading italic">{example}</p>}
    </div>
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

export function ExtraActions({ sentenceState, onSaveSentence, isPro, aiBusy, onExplain, onTranslate, onExample, onPlay }: {
  sentenceState: SentenceState;
  onSaveSentence: () => void;
  isPro: boolean;
  aiBusy: boolean;
  onExplain: () => void;
  onTranslate: () => void;
  onExample: () => void;
  onPlay: (() => void) | null;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      <button onClick={onSaveSentence} disabled={sentenceState !== "idle"} className={`${actionButton} disabled:opacity-60`}>
        {SENTENCE_LABELS[sentenceState]}
      </button>
      {isPro ? (
        <>
          <button onClick={onExplain} disabled={aiBusy} className={actionButton}>Explain with AI</button>
          <button onClick={onTranslate} disabled={aiBusy} className={actionButton}>Translate sentence</button>
          <button onClick={onExample} disabled={aiBusy} className={actionButton}>{aiBusy ? "Thinking…" : "AI example"}</button>
        </>
      ) : (
        <Link href="/settings/subscription" className="rounded-lg px-2.5 py-1.5 text-muted underline">AI explanations with Pro</Link>
      )}
      {onPlay && (
        <button onClick={onPlay} className={`ml-auto flex items-center gap-1 ${actionButton}`}>
          <PlayIcon className="size-3" /> Play from here
        </button>
      )}
    </div>
  );
}
