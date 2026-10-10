import { LEARNING_LANGUAGES } from "./languages";
import type { LanguageCode } from "./types";

export function parseLanguage(value: string | null | undefined): LanguageCode | null {
  return LEARNING_LANGUAGES.find((l) => l.code === value)?.code ?? null;
}

function withLanguage(path: string, language: string | null | undefined): string {
  const code = parseLanguage(language);
  return code ? `${path}?lang=${code}` : path;
}

export const signupHref = (language?: string | null) => withLanguage("/signup", language);

export const onboardingPath = (language?: string | null) => withLanguage("/onboarding", language);

export type DemoStatus = "new" | "learning" | "known";

export interface DemoToken {
  text: string;
  word?: { meaning: string; pos: string; reading?: string; known?: boolean };
}

export type DemoGloss = [text: string, meaning: string, pos: string, opts?: { k?: boolean; r?: string }];

export function demoSentence(words: (DemoGloss | string)[], gap = " "): DemoToken[] {
  const glossed = ([text, meaning, pos, { r, k } = {}]: DemoGloss): DemoToken => ({ text, word: { meaning, pos, reading: r, known: k } });
  return words.flatMap((w, i): DemoToken[] => {
    const token = typeof w === "string" ? { text: w } : glossed(w);
    const next = words[i + 1];
    const spaced = gap && next !== undefined && typeof next !== "string";
    return spaced ? [token, { text: gap }] : [token];
  });
}

export interface DemoState {
  statuses: Record<number, DemoStatus>;
  selected: number | null;
  lookups: number;
}

export function initialDemoState(tokens: DemoToken[]): DemoState {
  const statuses: Record<number, DemoStatus> = {};
  tokens.forEach((t, i) => {
    if (t.word) statuses[i] = t.word.known ? "known" : "new";
  });
  return { statuses, selected: null, lookups: 0 };
}

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
