"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PauseIcon, PlayIcon } from "@/components/icons";
import type { DemoToken } from "@/lib/landing";
import { LANGUAGES } from "@/lib/languages";
import type { LanguageCode } from "@/lib/types";
import { STEP_MS, nextSplash, splashFrame, splashOrder, splashTokens, type SplashState } from "@/lib/splash";

// The splash beside the sign-in and sign-up forms (auth-splash.feature): "a page that learns". A demo sentence learns
// its new words one at a time, then the page turns to the next language; "hello" drifts by behind it. The timeline
// is lib/splash.ts. Everything but the copy line is decorative (aria-hidden); the pause button is the only control.

/** "Hello" in many languages and scripts, with where each one floats (left %, top %, size rem, drift delay s). */
const GREETINGS: [string, number, number, number, number][] = [
  ["Hola", 8, 10, 1.6, 0], ["Bonjour", 62, 6, 1.3, -6], ["Hallo", 30, 24, 1.1, -12], ["Ciao", 80, 30, 1.8, -3],
  ["Olá", 12, 72, 1.4, -9], ["Hello", 70, 80, 1.2, -15], ["こんにちは", 44, 88, 1.1, -4], ["你好", 88, 58, 1.6, -11],
  ["안녕하세요", 4, 44, 1, -7], ["Привет", 54, 50, 1, -14], ["Γεια σου", 22, 92, 1.1, -2], ["नमस्ते", 76, 14, 1.2, -10],
  ["Merhaba", 36, 64, 0.9, -5], ["Hej", 92, 90, 1.3, -13], ["Salve", 50, 18, 0.9, -8], ["שלום", 16, 54, 1.2, -16],
];

function subscribeMedia(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const pageVisible = () => document.visibilityState === "visible";

/** Ticks the timeline every STEP_MS while `running`. */
function useSplash(running: boolean, languages: number, tokensFor: Parameters<typeof nextSplash>[2]) {
  const [state, setState] = useState<SplashState>({ lang: 0, step: 0 });
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setState((s) => nextSplash(s, languages, tokensFor)), STEP_MS);
    return () => clearInterval(timer);
  }, [running, languages, tokensFor]);
  return state;
}

/** The page of text: the sentence with its words coloured by status, the gloss of the word tapped, and the count. */
function SplashPage({ language, tokens, step, showGloss }: { language: LanguageCode; tokens: DemoToken[]; step: number; showGloss: boolean }) {
  const frame = splashFrame(tokens, step);
  const glossed = showGloss ? frame.glossed : null;
  const gloss = glossed === null ? null : tokens[glossed];
  return (
    <div aria-hidden className="splash-page relative rounded-xl border border-line bg-card p-4 shadow-sm lg:p-6">
      <p className="mb-2 text-xs font-semibold tracking-widest text-rubric uppercase">
        {LANGUAGES.find((l) => l.code === language)?.native}
      </p>
      <p data-testid="splash-words" aria-hidden className="reading text-lg lg:text-2xl">
        {tokens.map((t, i) => {
          const status = frame.statuses[i];
          if (!status) return <span key={i}>{t.text}</span>;
          return (
            <span key={i} className={`splash-word w-${status} ${glossed === i ? "splash-tapped" : ""}`}>
              {t.text}
            </span>
          );
        })}
      </p>
      <div className="mt-3 flex min-h-7 items-center justify-between gap-3 text-sm">
        {gloss?.word ? (
          <span key={glossed} data-testid="splash-gloss" className="splash-gloss rounded-md bg-paper px-2 py-0.5">
            <b className="font-semibold">{gloss.text}</b> — {gloss.word.meaning}
          </span>
        ) : (
          <span />
        )}
        <span className="shrink-0 text-muted">
          <span data-testid="splash-known" className="font-semibold text-ink tabular-nums">{frame.known}/{frame.total}</span> words known
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper">
        <div className="h-full rounded-full bg-good transition-[width] duration-500" style={{ width: `${(frame.known / frame.total) * 100}%` }} />
      </div>
    </div>
  );
}

export function AuthSplash({ copy, start }: { copy: string; start?: string | null }) {
  const order = useMemo(() => splashOrder(start), [start]);
  const tokensFor = useMemo(() => (lang: number) => splashTokens(order[lang]), [order]);
  const reduced = useSyncExternalStore(subscribeMedia, prefersReducedMotion, () => false);
  const visible = useSyncExternalStore(subscribeVisibility, pageVisible, () => true);
  const [playing, setPlaying] = useState(true);
  const running = playing && visible && !reduced;
  const { lang, step } = useSplash(running, order.length, tokensFor);
  const language = order[lang];

  return (
    <section
      data-testid="auth-splash"
      data-language={language}
      data-step={step}
      data-running={running}
      aria-label="A page that learns"
      className="auth-splash relative flex flex-col justify-center overflow-hidden border-b border-line bg-accent-soft px-5 py-6 lg:min-h-dvh lg:w-1/2 lg:border-r lg:border-b-0 lg:px-14"
    >
      <div data-testid="splash-greetings" aria-hidden className="pointer-events-none absolute inset-0 select-none">
        {GREETINGS.map(([word, left, top, size, delay]) => (
          <span
            key={word}
            className="splash-greeting absolute font-display text-accent"
            style={{ left: `${left}%`, top: `${top}%`, fontSize: `${size}rem`, animationDelay: `${delay}s` }}
          >
            {word}
          </span>
        ))}
      </div>

      {!reduced && (
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="absolute top-3 right-3 z-10 grid size-8 cursor-pointer place-items-center rounded-full border border-line bg-card text-muted hover:text-ink"
        >
          {playing ? <PauseIcon className="size-4" aria-hidden /> : <PlayIcon className="size-4" aria-hidden />}
          <span className="sr-only">{playing ? "Pause animation" : "Play animation"}</span>
        </button>
      )}

      <div className="relative mx-auto flex w-full max-w-md flex-col gap-4 lg:gap-8">
        <p className="pr-8 font-display text-2xl leading-tight font-semibold lg:pr-0 lg:text-4xl">{copy}</p>
        <SplashPage key={language} language={language} tokens={tokensFor(lang)} step={step} showGloss={!reduced} />
        <p className="hidden text-sm text-muted lg:block">
          Blue words are new, yellow ones you&apos;re learning. Tap one, and every page after gets a little easier.
        </p>
      </div>
    </section>
  );
}
