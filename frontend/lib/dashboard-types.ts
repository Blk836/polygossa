// Response types for GET /api/dashboard (the Progress page), kept in sync with DashboardController and ActivityTally.
import type { StatsPeriodKey } from "./progress";
import type { LanguageCode, ReviewStats } from "./types";

export interface Dashboard {
  languages: {
    language: LanguageCode;
    known: number;
    learning: number;
    ignored: number;
    sessions: number;
    readingSeconds: number;
  }[];
  totalSessions: number;
  totalReadingSeconds: number;
  textsImported: number;
  growth: { language: LanguageCode; known: { day: string; value: number }[] }[];
  readingMinutesByDay: { day: string; value: number }[];
  review: ReviewStats | null;
  activity: Activity;
  period: PeriodStats;
}

/** Totals for the chosen window (GET /api/dashboard?period=…) and the same length of time before it (none for all time). */
export interface PeriodStats {
  period: StatsPeriodKey;
  days: number;
  current: ActivityPeriod;
  previous: ActivityPeriod | null;
}

/** One day of practice (in the user's time zone). A day is active with a minute of reading or any word, review or test. */
export interface ActivityDay {
  day: string;
  readingSeconds: number;
  wordsSaved: number;
  wordsKnown: number;
  reviews: number;
  writingTests: number;
  active: boolean;
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
  activeDays: number;
}

/** The daily streak, the last 84 days (oldest first) and this week (last 7 days) against the 7 before. */
export interface Activity {
  streak: Streak;
  days: ActivityDay[];
  thisWeek: ActivityPeriod;
  lastWeek: ActivityPeriod;
}
