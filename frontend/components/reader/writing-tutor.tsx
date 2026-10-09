"use client";

import { useEffect, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import type { LanguageCode, WritingSubmission } from "@/lib/types";
import { Button, ErrorNote, UpgradeNote, inputClass } from "../ui";

export function WritingTutor({ textId, language, isPro }: { textId: number; language: LanguageCode; isPro: boolean }) {
  const [content, setContent] = useState("");
  const [history, setHistory] = useState<WritingSubmission[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPro) return;
    api<WritingSubmission[]>(`writing?textId=${textId}`).then(setHistory).catch(() => {});
  }, [textId, isPro]);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const s = await api<WritingSubmission>("writing", { body: { textId, language, content } });
      setHistory((h) => [s, ...h]);
      setContent("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Write about it</h2>
      <p className="mt-1 text-sm text-muted">
        Write a few sentences in {languageName(language)} about what you read. The AI tutor will correct them and explain why.
      </p>
      {!isPro ? (
        <div className="mt-3"><UpgradeNote message="The AI writing tutor is a Pro feature." /></div>
      ) : (
        <>
          <textarea
            className={`${inputClass} mt-3 min-h-28 font-reading text-base`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={4000}
            placeholder="…"
          />
          <div className="mt-2 flex items-center gap-3">
            <Button onClick={submit} disabled={busy || content.trim().length < 3}>{busy ? "Checking…" : "Get feedback"}</Button>
            <span className="text-xs text-muted">{content.length}/4000</span>
          </div>
          <div className="mt-2"><ErrorNote message={error} /></div>
        </>
      )}
      {history.map((s) => (
        <div key={s.id} className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <p className="text-xs text-muted">{new Date(s.createdAt).toLocaleString()}</p>
          <p className="font-reading">{s.content}</p>
          {s.feedback && (
            <>
              <div className="rounded-lg bg-accent-soft/60 p-3">
                <p className="text-xs font-medium text-muted">Corrected{s.feedback.level ? ` · about ${s.feedback.level}` : ""}</p>
                <p className="font-reading">{s.feedback.correctedText}</p>
              </div>
              {s.feedback.corrections.length > 0 && (
                <ul className="space-y-1.5">
                  {s.feedback.corrections.map((c, i) => (
                    <li key={i}>
                      <span className="text-danger line-through">{c.original}</span> →{" "}
                      <span className="font-medium text-accent">{c.corrected}</span>
                      <span className="block text-xs text-muted">{c.explanation}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="italic text-muted">{s.feedback.overallComment}</p>
            </>
          )}
        </div>
      ))}
    </section>
  );
}
