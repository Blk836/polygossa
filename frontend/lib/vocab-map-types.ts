import type { LanguageCode, WordStatus } from "./types";

export interface VocabMapWord {
  term: string;
  band: string;
  status: WordStatus | null;
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

export interface VocabMap {
  language: LanguageCode;
  available: boolean;
  readingLevel: string | null;
  bands: string[];
  meaningLanguage: string;
  beyondCore: number;
  regions: VocabMapRegion[];
}
