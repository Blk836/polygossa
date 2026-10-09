"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { InterestPicker } from "@/components/interest-picker";
import { useMe } from "@/components/me-context";
import { Button, ErrorNote, LevelBadge, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { parseLanguage } from "@/lib/landing";
import { LEARNING_LANGUAGES } from "@/lib/languages";
import { HOME } from "@/lib/nav";
import type { LanguageCode, Me, TextSummary } from "@/lib/types";

/** Sets the target language and fetches a few starter texts in it. */
function startLanguage(code: LanguageCode) {
  return Promise.all([
    api<Me>("me", {
      method: "PATCH",
      body: { targetLanguage: code, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    }),
    api<{ items: TextSummary[] }>(`library?language=${code}&size=6`),
  ]);
}

/**
 * Two steps to reading: pick a language, then (optionally saying what you like, for Explore's recommendations)
 * pick a starter text. A language picked on the landing page arrives as
 * ?lang= (through sign-up) and skips straight to step 2.
 */
export default function OnboardingPage() {
  const router = useRouter();
  const { setMe } = useMe();
  const params = useSearchParams();
  const [preset] = useState(() => parseLanguage(params.get("lang")));
  const [language, setLanguage] = useState<LanguageCode | null>(preset);
  const [texts, setTexts] = useState<TextSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!preset) return;
    let cancelled = false;
    startLanguage(preset)
      .then(([me, page]) => {
        if (cancelled) return;
        setMe(me);
        setTexts(page.items);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [preset, setMe]);

  async function choose(code: LanguageCode) {
    setLanguage(code);
    setTexts(null);
    setError(null);
    try {
      const [me, page] = await startLanguage(code);
      setMe(me);
      setTexts(page.items);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-sm font-medium text-accent">Step {language ? 2 : 1} of 2</p>
      <h1 className="mt-1 text-2xl font-semibold">{language ? "Pick something to read" : "What are you learning?"}</h1>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {LEARNING_LANGUAGES.map((l) => (
          <button
            key={l.code}
            onClick={() => choose(l.code)}
            aria-pressed={language === l.code}
            className={`rounded-xl border p-4 text-left transition ${
              language === l.code ? "border-accent bg-accent-soft" : "border-line bg-card hover:border-accent/50"
            }`}
          >
            <span className="block font-reading text-lg font-semibold">{l.native}</span>
            <span className="text-sm text-muted">{l.name}</span>
          </button>
        ))}
      </div>

      {language && <InterestPicker />}

      {language && (
        <div className="mt-8">
          <ErrorNote message={error} />
          {!texts && !error && <Spinner />}
          {texts && (
            <div className="space-y-3">
              {texts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => router.push(`/read/${t.id}`)}
                  className="flex w-full items-center gap-3 rounded-xl border border-line bg-card p-4 text-left hover:border-accent"
                >
                  <LevelBadge level={t.cefrLevel} />
                  <span className="font-reading text-lg font-semibold">{t.title}</span>
                  <span className="ml-auto text-sm text-muted">{t.wordCount} words →</span>
                </button>
              ))}
              {texts.length === 0 && <p className="text-sm text-muted">No starter texts yet for this language.</p>}
              <div className="flex flex-wrap items-center gap-3 pt-4 text-sm">
                <span className="text-muted">Or bring your own:</span>
                <Link href={`/import?language=${language}`} className="text-accent underline">Paste text or import a URL</Link>
                <Button variant="ghost" onClick={() => router.push(HOME)}>Skip for now</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
