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

/**
 * The meaning to show: the map's own (the learner's saved meaning, else the list's), else what the reader's word popup
 * would find (other learners' meanings, then machine translation). Undefined while looking, null when there is none.
 */
function useMeaning(language: LanguageCode, word: VocabMapWord): string | null | undefined {
  const [found, setFound] = useState<{ term: string; meaning: string | null } | null>(null);
  useEffect(() => {
    if (word.meaning) return;
    let cancelled = false;
    api<WordLookup>(`dictionary?${new URLSearchParams({ language, term: word.term })}`)
      .then((l) => !cancelled && setFound({ term: word.term, meaning: l.meanings.length ? l.meanings.join(", ") : null }))
      .catch(() => !cancelled && setFound({ term: word.term, meaning: null }));
    return () => {
      cancelled = true;
    };
  }, [language, word.term, word.meaning]);
  if (word.meaning) return word.meaning;
  return found?.term === word.term ? found.meaning : undefined;
}

/** A tapped word: its meaning, band and status, with "Start learning" and "I know this" as in the reader. */
export function WordPanel({ language, word, onSaved }: {
  language: LanguageCode;
  word: VocabMapWord;
  onSaved: (term: string, status: WordStatus) => void;
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
    <section aria-label={`The word ${word.term}`} data-testid="map-word-panel" className="mt-4 rounded-lg border border-line bg-paper p-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h3 className="font-display text-xl font-semibold">{word.term}</h3>
        <span className="rounded bg-card px-2 py-0.5 text-xs font-medium">{word.band}</span>
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

/** The free plan's saved-word limit gets the same upgrade note as in the reader; anything else a plain error. */
function SaveError({ error }: { error: unknown }) {
  if (error instanceof ApiError && error.upgradeRequired) return <UpgradeNote message={error.message} />;
  return <ErrorNote message={errorMessage(error)} />;
}
