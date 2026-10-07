// The admin panel (docs/acceptance/admin-panel.feature): response types for /api/admin and pure helpers, unit-tested.
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

/** GET path for a page of the user search. */
export function usersPath(q: string, page: number): string {
  const params = new URLSearchParams({ page: String(page) });
  if (q.trim()) params.set("q", q.trim());
  return `admin/users?${params}`;
}

/** Users per plan with each plan's share (whole percent). */
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

/** Each action: its button, the request it makes and the question asked before it runs. */
export const ACTIONS: Record<ActionKey, { label: string; method: "POST" | "DELETE"; path: (id: number) => string; confirm: (email: string) => string; yes: string; danger: boolean }> = {
  suspend: { label: "Suspend", method: "POST", path: (id) => `admin/users/${id}/suspend`, confirm: (e) => `Suspend ${e}?`, yes: "Yes, suspend", danger: true },
  unsuspend: { label: "Lift suspension", method: "POST", path: (id) => `admin/users/${id}/unsuspend`, confirm: (e) => `Lift the suspension of ${e}?`, yes: "Yes, lift suspension", danger: false },
  posts: { label: "Remove all forum posts", method: "DELETE", path: (id) => `admin/users/${id}/posts`, confirm: (e) => `Remove every forum post by ${e}? Threads they started go with their replies.`, yes: "Yes, remove posts", danger: true },
  playlists: { label: "Remove all playlists", method: "DELETE", path: (id) => `admin/users/${id}/playlists`, confirm: (e) => `Remove every playlist by ${e}?`, yes: "Yes, remove playlists", danger: true },
  texts: { label: "Remove all texts and videos", method: "DELETE", path: (id) => `admin/users/${id}/texts`, confirm: (e) => `Remove every text and video ${e} imported? This can't be undone.`, yes: "Yes, remove content", danger: true },
  unshare: { label: "Unshare everything", method: "POST", path: (id) => `admin/users/${id}/unshare`, confirm: (e) => `Make everything ${e} shared private?`, yes: "Yes, unshare", danger: false },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** What an action did, from its response. */
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
