import type { StatsPeriodKey } from "./progress";
import type { LanguageCode, ReviewStats } from "./types";

export interface Dashboard {
  languages: {
    language: LanguageCode;
    known: number;
    knownBase: number;
    learning: number;
    ignored: number;
    sessions: number;
    readingSeconds: number;
    wordsRead: number;
    listenedSeconds: number;
  }[];
  totalSessions: number;
  totalReadingSeconds: number;
  totalWordsRead: number;
  totalListenedSeconds: number;
  textsImported: number;
  growth: { language: LanguageCode; known: { day: string; value: number }[] }[];
  readingMinutesByDay: { day: string; value: number }[];
  review: ReviewStats | null;
  activity: Activity;
  period: PeriodStats;
  goal: GoalToday;
}

export type GoalKind = "reviews" | "words_read" | "minutes_read" | "minutes_listened";

export interface GoalToday {
  kind: GoalKind;
  target: number;
  done: number;
  met: boolean;
}

export interface PeriodStats {
  period: StatsPeriodKey;
  days: number;
  current: ActivityPeriod;
  previous: ActivityPeriod | null;
}

export interface ActivityDay {
  day: string;
  readingSeconds: number;
  wordsSaved: number;
  wordsKnown: number;
  reviews: number;
  writingTests: number;
  wordsRead: number;
  listenedSeconds: number;
  active: boolean;
  goalMet: boolean;
}

export interface Streak {
  current: number;
  best: number;
  activeToday: boolean;
}

export interface ActivityPeriod {
  readingSeconds: number;
  wordsSaved: number;
  wordsKnown: number;
  reviews: number;
  wordsRead: number;
  listenedSeconds: number;
  activeDays: number;
}

export interface Activity {
  streak: Streak;
  days: ActivityDay[];
  thisWeek: ActivityPeriod;
  lastWeek: ActivityPeriod;
}
