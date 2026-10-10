import type { LanguageCode } from "./types";

export interface AnkiDeckChoice {
  ankiDeckId: number;
  name: string;
  language: LanguageCode;
  wordField: string;
  meaningField?: string;
  firstSyncedAt?: string;
}

export type AnkiOutcome =
  | "became_known"
  | "added_known"
  | "added_learning"
  | "over_limit"
  | "skipped_empty"
  | "skipped_too_long"
  | "skipped_media"
  | "leave_review";

export interface AnkiRun {
  id: number;
  dryRun: boolean;
  state: "running" | "done" | "stopped";
  startedAt: string;
  finishedAt?: string | null;
  cards: number;
  becameKnown: number;
  addedKnown: number;
  addedLearning: number;
  overLimit: number;
  skippedEmpty: number;
  skippedTooLong: number;
  skippedMedia: number;
  leaveReview: number;
}

export interface AnkiCardPayload {
  word: string | null;
  type: number;
  interval: number;
  meaning?: string;
}

export interface AnkiWordLink {
  state: "new" | "young" | "mature";
  promoted: boolean;
}
