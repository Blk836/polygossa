// The forum (GET /api/forum/...): types mirroring the backend's ForumDtos, its categories and request paths.

export type ForumCategory = "announcements" | "bugs" | "ideas" | "general";

export interface ForumAuthor {
  id: number;
  name: string;
}

export interface ThreadSummary {
  id: number;
  category: ForumCategory;
  title: string;
  author: ForumAuthor;
  createdAt: string;
  lastPostAt: string;
  replies: number;
  pinned: boolean;
  locked: boolean;
}

export interface ThreadList {
  threads: ThreadSummary[];
  total: number;
  page: number;
  size: number;
  canModerate: boolean;
}

export interface ForumPost {
  id: number;
  author: ForumAuthor;
  body: string;
  createdAt: string;
  editedAt: string | null;
  /** The viewer wrote it, so may edit it. */
  mine: boolean;
}

export interface ThreadPage {
  thread: ThreadSummary;
  posts: ForumPost[];
  total: number;
  page: number;
  size: number;
  canModerate: boolean;
}

export const FORUM_CATEGORIES: { code: ForumCategory; label: string }[] = [
  { code: "announcements", label: "Announcements" },
  { code: "bugs", label: "Bug reports" },
  { code: "ideas", label: "Ideas" },
  { code: "general", label: "General" },
];

export function forumCategoryLabel(code: ForumCategory): string {
  return FORUM_CATEGORIES.find((c) => c.code === code)?.label ?? code;
}

/** Categories a learner can start a thread in: announcements are for the team. */
export function postableCategories(canModerate: boolean) {
  return FORUM_CATEGORIES.filter((c) => canModerate || c.code !== "announcements");
}

/** The category named in the URL, or null for All (and for anything unknown). */
export function categoryFromParam(param: string | null): ForumCategory | null {
  return FORUM_CATEGORIES.find((c) => c.code === param)?.code ?? null;
}

export function forumListPath(category: ForumCategory | null, page: number): string {
  return `forum/threads?${category ? `category=${category}&` : ""}page=${page}`;
}

export function threadPath(id: number, page: number): string {
  return `forum/threads/${id}?page=${page}`;
}

/** The forum page's own URL for a category and page. */
export function forumPageHref(category: ForumCategory | null, page: number): string {
  const params = new URLSearchParams();
  if (category) params.set("category", category);
  if (page > 0) params.set("page", String(page));
  const query = params.toString();
  return query ? `/forum?${query}` : "/forum";
}

/** Pages needed for `total` items; at least one. */
export function pageCount(total: number, size: number): number {
  return Math.max(1, Math.ceil(total / size));
}
