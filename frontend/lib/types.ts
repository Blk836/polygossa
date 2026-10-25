import type { Tours } from "./tours";
import type { GoalKind } from "./dashboard-types";
import type { HoneyJar } from "./header-stats";

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

export interface Billing {
  enabled: boolean;
  testMode: boolean;
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
  nativeLanguage: string;
  dailyReviewGoal: number;
  dailyGoal: { kind: GoalKind; target: number };
  streakNeedsGoal: boolean;
  timezone: string;
  plan: PlanInfo;
  photoUrl: string | null;
  admin: boolean;
  tours: Tours;
  ankiConnected: boolean;
  honeyJar: HoneyJar;
}

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
  fromBook: boolean;
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
  video?: { videoId: string; thumbnailUrl: string; durationSeconds?: number };
  category: Category;
  progress?: ReadingProgress;
}

export interface ReadingProgress {
  position: number;
  percent: number;
  completed: boolean;
}

export type Category =
  | "learners" | "daily-life" | "stories" | "news" | "culture" | "travel" | "food" | "science" | "history"
  | "entertainment" | "other";

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
  i: number;
  s: number;
  e: number;
}

export interface TextDetail {
  text: TextSummary;
  tokens: Token[];
  statuses: Record<string, WordStatus>;
  phrases: { term: string; status: WordStatus }[];
  audio: { src: string; contentType?: string; timings: WordTiming[]; hasCues: boolean } | null;
  video: { videoId: string; durationSeconds?: number; timings: WordTiming[]; hasCues: boolean } | null;
  speechLocale: string;
  setAside: string[];
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
}

export interface WordType {
  partOfSpeech: string;
  form: string | null;
  lemma: string | null;
}

export interface WordLookup {
  term: string;
  language: LanguageCode;
  meanings: string[];
  meaningLanguage: string | null;
  source: "community" | "machine" | "sentence" | null;
  wordType?: WordType | null;
}

export interface VocabularyEntry {
  id: number;
  term: string;
  displayTerm: string;
  language: LanguageCode;
  kind: EntryKind;
  status: WordStatus;
  definition?: string;
  meaning?: string;
  meaningLanguage?: string;
  partOfSpeech?: string;
  pronunciation?: string;
  example?: string;
  contextSentence?: string;
  note?: string;
  tags?: string[];
  sourceText?: { id: number; title: string };
  createdAt: string;
  updatedAt: string;
  dueAt?: string;
  anki?: { state: "new" | "young" | "mature"; promoted: boolean };
  met?: { count: number; share?: number };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface ReviewCard {
  type: "word";
  kind: "word" | "phrase";
  id: number;
  language: LanguageCode;
  front: string;
  definition?: string;
  pronunciation?: string;
  partOfSpeech?: string;
  context?: string;
  example?: string;
  notes?: string;
  sourceTextId?: number;
  sourceTextTitle?: string;
  dueAt: string;
  repetitions: number;
}

export interface ReviewStats {
  dueWords: number;
  reviewedToday: number;
  dailyGoal: number;
  goalMet: boolean;
  streak: number;
  history: { day: string; count: number }[];
  wordsInAnki: number;
}

export type { Activity, ActivityDay, ActivityPeriod, Dashboard, GoalKind, GoalToday, PeriodStats, Streak } from "./dashboard-types";
export type { LevelConfidence, Skill, SkillKey, SkillLevels } from "./level-types";
export type { VocabMap, VocabMapArea, VocabMapRegion, VocabMapWord } from "./vocab-map-types";

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
  score: number;
  comment: string;
}

export interface WritingGrade {
  score: number;
  level: CefrLevel | null;
  rubric: RubricScore[];
  corrections: { original: string; corrected: string; explanation: string }[];
  correctedText: string;
  summary: string;
}

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
  gradeModel?: string;
  gradePromptVersion?: string;
}
