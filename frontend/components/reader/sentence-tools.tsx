"use client";

import Link from "next/link";
import { useState } from "react";
import { api, errorMessage } from "@/lib/api";
import type { LanguageCode } from "@/lib/types";

type Shown = { kind: "hidden" } | { kind: "asking" } | { kind: "shown"; text: string } | { kind: "failed"; message: string };

export function SentenceTranslation({ text, language, isPro, cache }: {
  text: string;
  language: LanguageCode;
  isPro: boolean;
  cache: Map<string, string>;
}) {
  const [shown, setShown] = useState<Shown>({ kind: "hidden" });
  if (!isPro) {
    return (
      <Link href="/settings/subscription" className="text-xs text-muted underline">Sentence translations with Pro</Link>
    );
  }

  function reveal() {
    const known = cache.get(text);
    if (known !== undefined) return setShown({ kind: "shown", text: known });
    setShown({ kind: "asking" });
    api<{ translation: string }>("dictionary/translate", { body: { language, text } })
      .then((r) => {
        cache.set(text, r.translation);
        setShown({ kind: "shown", text: r.translation });
      })
      .catch((e) => setShown({ kind: "failed", message: errorMessage(e) }));
  }

  if (shown.kind === "shown") return <p data-testid="sentence-translation" className="w-full max-w-3xl text-center text-sm text-muted">{shown.text}</p>;
  if (shown.kind === "failed") return <p role="status" className="text-center text-xs text-muted">{shown.message}</p>;
  return (
    <button
      type="button"
      onClick={reveal}
      disabled={shown.kind === "asking"}
      aria-label="Tap to see the translation"
      className="group relative flex w-full max-w-md shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-line px-4 py-2.5"
    >
      <span aria-hidden className="flex w-full flex-col items-center gap-1.5 blur-[3px]">
        <span className="h-2 w-4/5 rounded-full bg-line" />
        <span className="h-2 w-3/5 rounded-full bg-line" />
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-xs text-muted group-hover:text-ink">
        {shown.kind === "asking" ? "Translating…" : "Tap to see the translation"}
      </span>
    </button>
  );
}

export function SaveSentence({ text, language, textId, onSaved }: { text: string; language: LanguageCode; textId: number; onSaved: () => void }) {
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  function save() {
    setState("saving");
    setError(null);
    api("vocabulary", { body: { language, term: text, kind: "phrase", textId } })
      .then(() => {
        setState("saved");
        onSaved();
      })
      .catch((e) => {
        setState("idle");
        setError(errorMessage(e));
      });
  }
  return (
    <>
      <button type="button" onClick={save} disabled={state !== "idle"} className="rounded-full border border-line px-3 py-1 hover:text-ink disabled:opacity-70">
        {state === "saved" ? "✓ Sentence saved" : state === "saving" ? "Saving…" : "Save sentence"}
      </button>
      {error && <span role="status">{error}</span>}
    </>
  );
}

export function PauseEachToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-accent" />
      Pause after each sentence
    </label>
  );
}

export function SentenceExtras({ text, language, textId, onSaved, media, pauseEach, onPauseEach }: Parameters<typeof SaveSentence>[0] & {
  media: { synced: boolean; playerBar: boolean };
  pauseEach: boolean;
  onPauseEach: (value: boolean) => void;
}) {
  return (
    <>
      <SaveSentence text={text} language={language} textId={textId} onSaved={onSaved} />
      {media.synced && media.playerBar && <PauseEachToggle checked={pauseEach} onChange={onPauseEach} />}
    </>
  );
}
