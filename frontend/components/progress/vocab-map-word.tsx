"use client";

import { useEffect, useState } from "react";
import { Button, ErrorNote, UpgradeNote } from "@/components/ui";
import { api, ApiError, errorMessage } from "@/lib/api";
import type { LanguageCode, VocabMapWord, WordLookup, WordStatus } from "@/lib/types";

const STATUS_TEXT: Record<string, string> = {
  known: "Known",
  learning: "Learning",
  ignored: "Ignored",
  new: "New to you",
};

function useMeaning(language: LanguageCode, word: VocabMapWord): string | null | undefined {
  const [found, setFound] = useState<{ term: string; meaning: string | null } | null>(null);
  useEffect(() => {
    if (word.meaning) return;
    let cancelled = false;
    api<WordLookup>(`dictionary?${new URLSearchParams({ language, term: word.term, bare: "true" })}`)
      .then((l) => !cancelled && setFound({ term: word.term, meaning: l.meanings.length ? l.meanings.join(", ") : null }))
      .catch(() => !cancelled && setFound({ term: word.term, meaning: null }));
    return () => {
      cancelled = true;
    };
  }, [language, word.term, word.meaning]);
  if (word.meaning) return word.meaning;
  return found?.term === word.term ? found.meaning : undefined;
}

export function WordPanel({ language, word, onSaved, onClose }: {
  language: LanguageCode;
  word: VocabMapWord;
  onSaved: (term: string, status: WordStatus) => void;
  onClose: () => void;
}) {
  const meaning = useMeaning(language, word);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ term: string; error: unknown } | null>(null);
  const shownError = error?.term === word.term ? error.error : null;

  async function save(status: WordStatus) {
    setBusy(true);
    setError(null);
    try {
      await api("vocabulary", { body: { language, term: word.term, status, meaning: meaning ?? undefined } });
      onSaved(word.term, status);
    } catch (e) {
      setError({ term: word.term, error: e });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label={`The word ${word.term}`} data-testid="map-word-panel"
      className="map-glass bottom-3 left-1/2 z-10 w-[min(22.5rem,calc(100%-1.5rem))] -translate-x-1/2 p-4 pr-10">
      <button type="button" aria-label="Close" onClick={onClose}
        className="absolute right-2 top-2 grid size-8 place-items-center rounded-lg text-lg leading-none text-muted hover:bg-accent-soft">
        ×
      </button>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-xl font-semibold">{word.term}</h3>
        <span className="rounded bg-accent-soft px-2 py-0.5 text-xs font-medium">{word.band}</span>
        <span className="text-sm text-muted" data-testid="map-word-status">{STATUS_TEXT[word.status ?? "new"]}</span>
      </div>
      <p className="mt-2" data-testid="map-word-meaning"><MeaningText meaning={meaning} /></p>
      <div className="mt-3 flex flex-wrap gap-2">
        {word.status !== "learning" && word.status !== "known" && (
          <Button type="button" disabled={busy} onClick={() => void save("learning")}>Start learning</Button>
        )}
        {word.status !== "known" && (
          <Button type="button" variant="secondary" disabled={busy} onClick={() => void save("known")}>I know this</Button>
        )}
      </div>
      {shownError !== null && <div className="mt-3"><SaveError error={shownError} /></div>}
    </section>
  );
}

function MeaningText({ meaning }: { meaning: string | null | undefined }) {
  if (meaning === undefined) return <span className="text-muted">Looking up the meaning…</span>;
  return meaning ?? <span className="text-muted">No meaning found</span>;
}

function SaveError({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.upgradeRequired) return <UpgradeNote message={error.message} />;
  return <ErrorNote message={errorMessage(error)} />;
}
