import type { Tours } from "./tours";
import type { GoalKind } from "./dashboard-types";
// Shapes of the Spring Boot API's JSON responses.

export type LanguageCode = "en" | "es" | "fr" | "de" | "it" | "pt" | "ja" | "zh" | "ko";
export type WordStatus = "learning" | "known" | "ignored";
export type EntryKind = "word" | "phrase";
export type Tier = "FREE" | "PRO" | "CLASSROOM";
export type CefrLevel = "A1" | "A2" | "B1" | "B2" | "C1" | "C2";
export type MediaKind = "text" | "video";

export interface PlanInfo {
  tier: Tier;
  effectiveTier: Tier;
  sponsoredByClassroom: boolean;
  limits: { texts: number | null; savedWords: number | null };
  usage: { texts: number; savedWords: number };
}

/** Settings › Subscription's view of Stripe billing (GET /api/billing); `enabled` false keeps the plan switch. */
export interface Billing {
  enabled: boolean;
  testMode: boolean;
  /** The price bought (pro_monthly, pro_yearly, classroom_monthly), or null without a live subscription. */
  plan: string | null;
  interval: "month" | "year" | null;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paymentProblem: boolean;
}

export interface Me {
  id: number;
  email: string;
  displayName: string;
  targetLanguage: LanguageCode | null;
  /** The language definitions are translated into ("en" by default). */
  nativeLanguage: string;
  dailyReviewGoal: number;
  /** What the daily goal measures and its target (a reviews goal's target is dailyReviewGoal). */
  dailyGoal: { kind: GoalKind; target: number };
  /** Opt-in: only days that reach the goal count toward the streak. */
  streakNeedsGoal: boolean;
  timezone: string;
  plan: PlanInfo;
  photoUrl: string | null; // the profile photo, served through the BFF; null for none
  /** One of the team (FORUM_ADMINS): the account menu offers the admin panel. */
  admin: boolean;
  /** First-visit tours: on for new accounts; the ones already seen are not shown again. */
  tours: Tours;
}

/** Someone named in the app (an owner, author or student), with their profile photo or null. */
export type Person = { id: number; displayName: string; photoUrl: string | null };

export interface KnownStats {
  uniqueWords: number;
  known: number;
  learning: number;
  ignored: number;
  unseen: number;
  knownPercent: number;
}

export interface TextSummary {
  id: number;
  title: string;
  language: LanguageCode;
  cefrLevel: CefrLevel;
  wordCount: number;
  uniqueWordCount: number;
  isPublic: boolean;
  sourceUrl?: string;
  createdAt: string;
  owner: Person;
  mine: boolean;
  hasAudio: boolean;
  likes?: number;
  liked?: boolean;
  bookmarked?: boolean;
  stats?: KnownStats;
  kind: MediaKind;
  /** Present for videos only. */
  video?: { videoId: string; thumbnailUrl: string; durationSeconds?: number };
  category: Category;
  /** How far the viewer has read; absent until they open it. */
  progress?: ReadingProgress;
}

/** `position`: the token to resume at; `percent`: words before the furthest point reached (100 once finished). */
export interface ReadingProgress {
  position: number;
  percent: number;
  completed: boolean;
}

/** Library categories; see lib/categories.ts for labels. "other" holds anything uncategorised. */
export type Category =
  | "learners" | "daily-life" | "stories" | "news" | "culture" | "travel" | "food" | "science" | "history"
  | "entertainment" | "other";

/** One Explore shelf: the newest public items in a category and how many there are in all. */
export interface Shelf {
  category: Category;
  total: number;
  items: TextSummary[];
}

export interface Token {
  index: number;
  text: string;
  word: boolean;
  normalized?: string;
  lemma?: string;
  reading?: string;
  sentence: number;
}

export interface WordTiming {
  i: number; // token index
  s: number; // start ms
  e: number; // end ms
}

export interface TextDetail {
  text: TextSummary;
  tokens: Token[];
  statuses: Record<string, WordStatus>;
  phrases: { term: string; status: WordStatus }[];
  audio: { src: string; contentType?: string; timings: WordTiming[]; hasCues: boolean } | null;
  /** Present for videos: the YouTube id and word timings that drive highlighting while it plays. */
  video: { videoId: string; durationSeconds?: number; timings: WordTiming[]; hasCues: boolean } | null;
  speechLocale: string;
}

export interface Sense {
  partOfSpeech: string;
  definition: string;
  examples: string[];
}

export interface DictionaryResult {
  term: string;
  language: LanguageCode;
  found: boolean;
  pronunciation?: string | null;
  senses: Sense[];
  lemma?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  /** The word in the learner's native language (empty when none was found); absent or null for English speakers. */
  translations?: string[] | null;
  translationLanguage?: string | null;
  /** Where the translations came from: other learners' saved meanings, the dictionary, or machine translation. */
  translationSource?: "community" | "dictionary" | "machine" | null;
}

export interface VocabularyEntry {
  id: number;
  term: string;
  displayTerm: string;
  language: LanguageCode;
  kind: EntryKind;
  status: WordStatus;
  definition?: string;
  /** The word in the learner's own language, and that language's code. */
  meaning?: string;
  meaningLanguage?: string;
  partOfSpeech?: string;
  pronunciation?: string;
  example?: string;
  contextSentence?: string;
  /** The learner's own note and tags (lower-case, one word each). */
  note?: string;
  tags?: string[];
  sourceText?: { id: number; title: string };
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface SentenceCard {
  id: number;
  language: LanguageCode;
  sentence: string;
  translation?: string;
  notes?: string;
  sourceTextId?: number;
  sourceTextTitle?: string;
  createdAt: string;
  dueAt: string;
}

export interface ReviewCard {
  type: "word" | "sentence";
  id: number;
  language: LanguageCode;
  front: string;
  definition?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  context?: string;
  example?: string;
  translation?: string;
  notes?: string;
  sourceTextId?: number;
  sourceTextTitle?: string;
  dueAt: string;
  repetitions: number;
}

export interface ReviewStats {
  dueWords: number;
  dueSentences: number;
  reviewedToday: number;
  dailyGoal: number;
  goalMet: boolean;
  streak: number;
  history: { day: string; count: number }[];
}

export type { Activity, ActivityDay, ActivityPeriod, Dashboard, GoalKind, GoalToday, PeriodStats, Streak } from "./dashboard-types";
export type { LevelConfidence, Skill, SkillKey, SkillLevels } from "./level-types";

export type { Assignment, ClassDetail, ClassProgress, ClassSummary, StudentProgress } from "./class-types";

export interface WritingFeedback {
  correctedText: string;
  corrections: { original: string; corrected: string; explanation: string }[];
  overallComment: string;
  level?: string;
}

export interface WritingSubmission {
  id: number;
  textId?: number;
  language: LanguageCode;
  content: string;
  feedback?: WritingFeedback;
  createdAt: string;
}

export interface RubricScore {
  criterion: "task" | "grammar" | "vocabulary" | "coherence";
  /** 1–5 */
  score: number;
  comment: string;
}

export interface WritingGrade {
  /** 0–100; capped in proportion when the answer was shorter than the minimum. */
  score: number;
  level: CefrLevel | null;
  rubric: RubricScore[];
  corrections: { original: string; corrected: string; explanation: string }[];
  correctedText: string;
  summary: string;
}

/** A timed writing test (GET/POST /api/writing/tests). */
export interface WritingTest {
  id: number;
  language: LanguageCode;
  level: CefrLevel;
  prompt: string;
  minWords: number;
  unit: "words" | "characters";
  timeLimitSeconds: number;
  startedAt: string;
  deadline: string;
  status: "in_progress" | "expired" | "ungraded" | "graded";
  content?: string;
  wordCount?: number;
  submittedAt?: string;
  grade?: WritingGrade;
  gradeError?: string;
  /** The AI model and grading-prompt version that produced the grade. */
  gradeModel?: string;
  gradePromptVersion?: string;
}
