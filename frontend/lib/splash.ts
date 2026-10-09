import { parseLanguage, type DemoStatus, type DemoToken } from "./landing";
import { DEMOS } from "./landing-demos";
import { LEARNING_LANGUAGES } from "./languages";
import type { LanguageCode } from "./types";

export const STEP_MS = 1100;
export const PAUSE_STEPS = 2;

export function splashOrder(start?: string | null): LanguageCode[] {
  const codes = LEARNING_LANGUAGES.map((l) => l.code);
  const picked = parseLanguage(start);
  const first = picked ? codes.indexOf(picked) : 0;
  return [...codes.slice(first), ...codes.slice(0, first)];
}

export const splashTokens = (language: LanguageCode): DemoToken[] => DEMOS[language];

const newWords = (tokens: DemoToken[]) => tokens.flatMap((t, i) => (t.word && !t.word.known ? [i] : []));

export const lastStep = (tokens: DemoToken[]) => newWords(tokens).length * 2;

export interface SplashFrame {
  statuses: (DemoStatus | null)[];
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
    if (order < current) return "known";
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
  lang: number;
  step: number;
}

export function nextSplash(state: SplashState, languages: number, tokensFor: (lang: number) => DemoToken[]): SplashState {
  if (state.step < lastStep(tokensFor(state.lang)) + PAUSE_STEPS) return { ...state, step: state.step + 1 };
  return { lang: (state.lang + 1) % languages, step: 0 };
}
