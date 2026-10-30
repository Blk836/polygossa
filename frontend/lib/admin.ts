import { NATIVE_LANGUAGES } from "./dictionary";
import { languageName } from "./languages";
import type { Tier } from "./types";

export interface DayValue {
  day: string;
  value: number;
}

export interface AdminStats {
  users: { total: number; perPlan: { free: number; pro: number; classroom: number }; suspended: number; newToday: number };
  signups: DayValue[];
  active: DayValue[];
  activeToday: number;
  active7: number;
  active30: number;
  languages: { language: string; users: number }[];
  content: {
    texts: number;
    publicTexts: number;
    videos: number;
    playlists: number;
    forumThreads: number;
    forumPosts: number;
    savedWords: number;
    reviewsToday: number;
    wordsReadToday: number;
    aiCallsToday: number;
  };
}

export interface AdminUserRow {
  id: number;
  email: string;
  displayName: string;
  plan: Tier;
  createdAt: string;
  lastActive: string | null;
  suspended: boolean;
  admin: boolean;
  texts: number;
  playlists: number;
  posts: number;
}

export interface AdminUserPage {
  items: AdminUserRow[];
  total: number;
  page: number;
  size: number;
}

export interface AdminItem {
  id: number;
  title: string;
  isPublic: boolean;
  kind: "text" | "video" | "playlist";
}

export interface TidyReport {
  textId: number;
  title: string;
  ownerId: number;
  lines: number;
  tidiedLines: number;
}

export function tidySummary(r: TidyReport): string {
  return `Tidied ${r.tidiedLines} of ${r.lines} lines in “${r.title}”`;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  suspendedReason: string | null;
  texts: AdminItem[];
  playlists: AdminItem[];
}

export interface AdminActionRow {
  at: string;
  admin: string;
  action: string;
  target: string | null;
  detail: string | null;
}

export function usersPath(q: string, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (q.trim()) params.set("q", q.trim());
  return `admin/users?${params}`;
}

export function planCounts(perPlan: AdminStats["users"]["perPlan"]): { label: string; count: number; percent: number }[] {
  const total = perPlan.free + perPlan.pro + perPlan.classroom;
  const share = (n: number) => (total === 0 ? 0 : Math.round((n / total) * 100));
  return [
    { label: "Free", count: perPlan.free, percent: share(perPlan.free) },
    { label: "Pro", count: perPlan.pro, percent: share(perPlan.pro) },
    { label: "Classroom", count: perPlan.classroom, percent: share(perPlan.classroom) },
  ];
}

export type ActionKey = "suspend" | "unsuspend" | "posts" | "playlists" | "texts" | "unshare";

export const ACTIONS: Record<ActionKey, { label: string; method: "POST" | "DELETE"; path: (id: number) => string; confirm: (email: string) => string; yes: string; danger: boolean }> = {
  suspend: { label: "Suspend", method: "POST", path: (id) => `admin/users/${id}/suspend`, confirm: (e) => `Suspend ${e}?`, yes: "Yes, suspend", danger: true },
  unsuspend: { label: "Lift suspension", method: "POST", path: (id) => `admin/users/${id}/unsuspend`, confirm: (e) => `Lift the suspension of ${e}?`, yes: "Yes, lift suspension", danger: false },
  posts: { label: "Remove all forum posts", method: "DELETE", path: (id) => `admin/users/${id}/posts`, confirm: (e) => `Remove every forum post by ${e}? Threads they started go with their replies.`, yes: "Yes, remove posts", danger: true },
  playlists: { label: "Remove all playlists", method: "DELETE", path: (id) => `admin/users/${id}/playlists`, confirm: (e) => `Remove every playlist by ${e}?`, yes: "Yes, remove playlists", danger: true },
  texts: { label: "Remove all texts and videos", method: "DELETE", path: (id) => `admin/users/${id}/texts`, confirm: (e) => `Remove every text and video ${e} imported? This can't be undone.`, yes: "Yes, remove content", danger: true },
  unshare: { label: "Unshare everything", method: "POST", path: (id) => `admin/users/${id}/unshare`, confirm: (e) => `Make everything ${e} shared private?`, yes: "Yes, unshare", danger: false },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function actionSummary(action: ActionKey, result: Record<string, number>): string {
  switch (action) {
    case "posts":
      return `Removed ${plural(result.posts, "post")} (${plural(result.threads, "thread")})`;
    case "texts":
      return `Removed ${plural(result.texts, "text")} and videos`;
    case "playlists":
      return `Removed ${plural(result.playlists, "playlist")}`;
    case "unshare":
      return `Made ${plural(result.texts, "text")} and ${plural(result.playlists, "playlist")} private`;
    case "suspend":
      return "Suspended";
    case "unsuspend":
      return "Suspension lifted";
  }
}

export type AdminTabKey = "overview" | "users" | "translations" | "ai" | "log";

export const ADMIN_TABS: { key: AdminTabKey; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/admin" },
  { key: "users", label: "Users", href: "/admin?tab=users" },
  { key: "translations", label: "Translations", href: "/admin?tab=translations" },
  { key: "ai", label: "AI", href: "/admin?tab=ai" },
  { key: "log", label: "Log", href: "/admin?tab=log" },
];

export function adminTab(param: string | string[] | undefined): AdminTabKey {
  const value = Array.isArray(param) ? param[0] : param;
  return ADMIN_TABS.find((t) => t.key === value)?.key ?? "overview";
}

export type LookupLayer = "aiStored" | "aiNew" | "community" | "none";

export const LOOKUP_LAYERS: { key: LookupLayer; label: string; chart: string }[] = [
  { key: "aiStored", label: "AI, stored", chart: "Lookups answered by a stored AI meaning" },
  { key: "aiNew", label: "AI, new", chart: "Lookups answered by a new AI call" },
  { key: "community", label: "Community", chart: "Lookups answered by the community" },
  { key: "none", label: "Nothing found", chart: "Lookups with nothing found" },
];

export interface TranslationRow {
  source: string | null;
  target: string | null;
  lookups: number;
  layers: Record<LookupLayer, number>;
  hitRate: number | null;
  aiCalls: number;
  aiTokensIn: number;
  aiTokensOut: number;
  aiFailures: number;
  cost: number;
  costPer1000Lookups: number | null;
  stored: { sentenceMeanings: number; communityWords: number };
}

export interface AdminTranslations {
  days: number;
  prices: { aiInputPerMillionTokens: number; aiOutputPerMillionTokens: number };
  pairs: TranslationRow[];
  total: TranslationRow;
  trend: { day: string; layers: Record<LookupLayer, number>; cost: number }[];
}

export interface AiJobRow {
  job: string | null;
  system: boolean;
  calls: number;
  failures: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
}

export interface AdminAi {
  days: number;
  prices: AdminTranslations["prices"];
  today: { day: string; systemTokens: number; ceiling: number };
  jobs: AiJobRow[];
  total: AiJobRow;
}

const AI_JOBS: Record<string, string> = {
  DEFINITION: "Word definitions",
  EXAMPLE: "Example sentences",
  TRANSLATION: "Translations",
  WRITING_FEEDBACK: "Writing feedback",
  WRITING_GRADE: "Writing test grades",
  WORD_MEANING: "Word meanings",
  CONTENT_REVIEW: "Content review",
  TOPIC_TAGS: "Topic tagging",
  TRANSCRIPT_TIDY: "Transcript tidying",
  PERSON_NAMES: "People's names",
  NOT_WORDS: "Not-words check",
};

export interface NotWordsPlan {
  language: string;
  texts: number;
  words: number;
  calls: number;
  estimatedTokens: number;
  estimatedCost: number;
}

export interface NotWordsReport {
  language: string;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  notWords: string[];
  wordsLeft: number;
  textsUpdated: number;
  wordsIgnored: number;
  stopped: "done" | "calls" | "cap" | "ceiling" | "off" | "failed";
}

export function aiJobName(job: string | null): string {
  return job === null ? "Total" : AI_JOBS[job] ?? job;
}

export function pairName(source: string | null, target: string | null): string {
  if (source === null || target === null) return "Total";
  return `${languageName(source)} → ${NATIVE_LANGUAGES.find((l) => l.code === target)?.name ?? target}`;
}

export function percent(fraction: number | null): string {
  return fraction === null ? "—" : `${Math.round(fraction * 100)}%`;
}

export function share(part: number, whole: number): string {
  return whole === 0 ? "—" : percent(part / whole);
}

export function dollars(amount: number | null): string {
  if (amount === null) return "—";
  if (amount > 0 && amount < 0.005) return "<$0.01";
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function cents(amount: number): number {
  return Math.round(amount * 10_000) / 100;
}
