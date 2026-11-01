import { api } from "@/lib/api";
import { withMeaningFirst } from "@/lib/dictionary";
import type { LanguageCode, WordLookup } from "@/lib/types";
import type { TextAround } from "./reader-text";

const lookupCache = new Map<string, Promise<WordLookup>>();
const unpicked = new WeakSet<Promise<WordLookup>>();

function wordKey(language: LanguageCode, term: string, nativeLanguage: string): string {
  return JSON.stringify([nativeLanguage, language, term]);
}

export function cacheKey(language: LanguageCode, term: string, nativeLanguage: string, around: TextAround): string {
  return JSON.stringify([wordKey(language, term, nativeLanguage), around.before, around.after]);
}

export function pickEverywhere(language: LanguageCode, term: string, nativeLanguage: string, meaning: string) {
  const prefix = JSON.stringify([wordKey(language, term, nativeLanguage)]).slice(0, -1) + ",";
  for (const [key, p] of lookupCache) {
    if (key.startsWith(prefix)) lookupCache.set(key, p.then((r) => withMeaningFirst(r, meaning)));
  }
}

export function rememberPicked(key: string, picked: WordLookup) {
  lookupCache.set(key, Promise.resolve(picked));
}

export function lookup(language: LanguageCode, term: string, nativeLanguage: string, around: TextAround): Promise<WordLookup> {
  const key = cacheKey(language, term, nativeLanguage, around);
  let p = lookupCache.get(key);
  if (!p) {
    const params = new URLSearchParams({ language, term });
    if (around.before) params.set("before", around.before);
    if (around.after) params.set("after", around.after);
    p = api<WordLookup>(`dictionary?${params}`);
    p.catch(() => lookupCache.delete(key));
    lookupCache.set(key, p);
    unpicked.add(p);
  }
  return p;
}

export function forgetUnlessFromTheAi(key: string) {
  const p = lookupCache.get(key);
  if (!p || !unpicked.has(p)) return;
  void p.then((r) => {
    if (r.source !== "sentence" && lookupCache.get(key) === p) lookupCache.delete(key);
  }, () => undefined);
}
