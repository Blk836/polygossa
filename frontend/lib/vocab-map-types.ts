// Response types for GET /api/vocab-map (the vocabulary map on Progress), kept in sync with VocabMapService.
import type { LanguageCode, WordStatus } from "./types";

/** A word on the map: its status over all its forms (null when new) and its meaning in the learner's language. */
export interface VocabMapWord {
  term: string;
  band: string;
  status: WordStatus | null;
  /** The learner's own saved meaning, else the list's; null when the list has none in their language. */
  meaning: string | null;
}

export interface VocabMapArea {
  id: string;
  name: string;
  words: VocabMapWord[];
}

export interface VocabMapRegion {
  id: string;
  name: string;
  areas: VocabMapArea[];
}

/** GET /api/vocab-map: `available` is false for a language with no word list yet, and then nothing else is filled. */
export interface VocabMap {
  language: LanguageCode;
  available: boolean;
  readingLevel: string | null;
  /** The bands the list has, from A1 up. */
  bands: string[];
  meaningLanguage: string;
  /** Known words that aren't in the list. */
  beyondCore: number;
  regions: VocabMapRegion[];
}
