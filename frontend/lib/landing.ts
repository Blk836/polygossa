// Landing page logic: where sign-up links go (carrying the language a visitor picked through sign-up into
// onboarding), and the try-it-now reader demo's state. The demo texts themselves are in landing-demos.ts.
import { LANGUAGES } from "./languages";
import type { LanguageCode } from "./types";

/** A supported language code, or null for anything else (absent, blank, unknown, wrong case). */
export function parseLanguage(value: string | null | undefined): LanguageCode | null {
  return LANGUAGES.find((l) => l.code === value)?.code ?? null;
}

function withLanguage(path: string, language: string | null | undefined): string {
  const code = parseLanguage(language);
  return code ? `${path}?lang=${code}` : path;
}

/** The sign-up page, remembering the language picked on the landing page. */
export const signupHref = (language?: string | null) => withLanguage("/signup", language);

/** Where a new account goes: onboarding, starting from the language picked before signing up. */
export const onboardingPath = (language?: string | null) => withLanguage("/onboarding", language);

// ---- the demo reader ----

export type DemoStatus = "new" | "learning" | "known";

export interface DemoToken {
  text: string;
  /** Present on words (clickable); absent on spaces and punctuation. */
  word?: { meaning: string; pos: string; reading?: string; known?: boolean };
}

export interface DemoState {
  /** Status of each word token, by token index. */
  statuses: Record<number, DemoStatus>;
  selected: number | null;
  /** How many different words the visitor has looked up. */
  lookups: number;
}

export function initialDemoState(tokens: DemoToken[]): DemoState {
  const statuses: Record<number, DemoStatus> = {};
  tokens.forEach((t, i) => {
    if (t.word) statuses[i] = t.word.known ? "known" : "new";
  });
  return { statuses, selected: null, lookups: 0 };
}

/** Clicking a word opens it; a new word becomes "learning", as in the real reader. Non-words are ignored. */
export function selectWord(state: DemoState, index: number): DemoState {
  const status = state.statuses[index];
  if (status === undefined) return state;
  if (status !== "new") return { ...state, selected: index };
  return { statuses: { ...state.statuses, [index]: "learning" }, selected: index, lookups: state.lookups + 1 };
}

export function setDemoStatus(state: DemoState, status: DemoStatus): DemoState {
  if (state.selected === null) return state;
  return { ...state, statuses: { ...state.statuses, [state.selected]: status } };
}

export const closeWord = (state: DemoState): DemoState => ({ ...state, selected: null });

export function demoCounts(state: DemoState): { known: number; total: number; percent: number } {
  const all = Object.values(state.statuses);
  const known = all.filter((s) => s === "known").length;
  return { known, total: all.length, percent: all.length ? Math.round((known * 100) / all.length) : 0 };
}
