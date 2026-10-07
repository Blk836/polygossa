// The sign-in/sign-up splash's timeline (auth-splash.feature): a demo sentence whose new words are tapped one at a
// time — glossed while still new, then learning, then known as the next is tapped — before the page turns to the
// next language. Steps are whole ticks; components/auth-splash.tsx ticks every STEP_MS.
import { parseLanguage, type DemoStatus, type DemoToken } from "./landing";
import { DEMOS } from "./landing-demos";
import { LEARNING_LANGUAGES } from "./languages";
import type { LanguageCode } from "./types";

export const STEP_MS = 1100;
/** Ticks the finished page is held before it turns. */
export const PAUSE_STEPS = 2;

/** Every learnable language, starting with the one picked (English when none or an unsupported one). */
export function splashOrder(start?: string | null): LanguageCode[] {
  const codes = LEARNING_LANGUAGES.map((l) => l.code);
  const picked = parseLanguage(start);
  const first = picked ? codes.indexOf(picked) : 0;
  return [...codes.slice(first), ...codes.slice(0, first)];
}

export const splashTokens = (language: LanguageCode): DemoToken[] => DEMOS[language];

const newWords = (tokens: DemoToken[]) => tokens.flatMap((t, i) => (t.word && !t.word.known ? [i] : []));

/** The step at which every word is known. */
export const lastStep = (tokens: DemoToken[]) => newWords(tokens).length * 2;

export interface SplashFrame {
  /** Per token: the word's status, or null for spaces and punctuation. */
  statuses: (DemoStatus | null)[];
  /** The token whose meaning is shown, if any. */
  glossed: number | null;
  known: number;
  total: number;
  done: boolean;
}

export function splashFrame(tokens: DemoToken[], step: number): SplashFrame {
  const fresh = newWords(tokens);
  const current = Math.min(Math.floor(step / 2), fresh.length);
  const statuses = tokens.map((t, i): DemoStatus | null => {
    if (!t.word) return null;
    const order = fresh.indexOf(i);
    if (order < current) return "known"; // includes words known from the start (order -1)
    if (order > current) return "new";
    return step % 2 === 0 ? "new" : "learning";
  });
  const total = tokens.filter((t) => t.word).length;
  return {
    statuses,
    glossed: current < fresh.length ? fresh[current] : null,
    known: total - fresh.length + current,
    total,
    done: current === fresh.length,
  };
}

export interface SplashState {
  /** Index into the language order. */
  lang: number;
  step: number;
}

/** One tick on: the next step, or the next language (wrapping round) once the finished page has been held. */
export function nextSplash(state: SplashState, languages: number, tokensFor: (lang: number) => DemoToken[]): SplashState {
  if (state.step < lastStep(tokensFor(state.lang)) + PAUSE_STEPS) return { ...state, step: state.step + 1 };
  return { lang: (state.lang + 1) % languages, step: 0 };
}
