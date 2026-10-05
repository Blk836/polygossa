// Library categories (a short fixed list, mirroring the backend's Category enum) and Explore's query building.
import type { KindFilter } from "./media";
import type { Category, TextSummary } from "./types";

export interface CategoryInfo {
  code: Category;
  label: string;
  blurb: string;
}

export const CATEGORIES: CategoryInfo[] = [
  { code: "learners", label: "For learners", blurb: "Podcasts, lessons and stories made for people learning the language" },
  { code: "daily-life", label: "Everyday life", blurb: "Mornings, neighbours, cafés: the language of ordinary days" },
  { code: "stories", label: "Stories", blurb: "Short fiction and narratives to get lost in" },
  { code: "news", label: "News & society", blurb: "Current events, politics and the world around us" },
  { code: "culture", label: "Culture & arts", blurb: "Books, art, music, traditions and ideas" },
  { code: "travel", label: "Travel", blurb: "Places, journeys and getting around" },
  { code: "food", label: "Food & cooking", blurb: "Markets, recipes and meals with family" },
  { code: "science", label: "Science & tech", blurb: "How things work, from cells to software" },
  { code: "history", label: "History", blurb: "People and events that shaped the world" },
  { code: "entertainment", label: "Entertainment", blurb: "Films, series, games, sport and fun" },
  { code: "other", label: "Other", blurb: "Everything that doesn't fit a shelf yet" },
];

export function categoryInfo(code: string | null | undefined): CategoryInfo | undefined {
  return CATEGORIES.find((c) => c.code === code);
}

export function categoryLabel(code: string | null | undefined): string {
  return categoryInfo(code)?.label ?? "Other";
}

export function isCategory(value: string | null | undefined): value is Category {
  return categoryInfo(value) !== undefined;
}

/** The categories that occur in a list of items, in the fixed order. */
export function categoriesIn(items: TextSummary[]): Category[] {
  const present = new Set(items.map((t) => t.category));
  return CATEGORIES.map((c) => c.code).filter((c) => present.has(c));
}

export interface ExploreFilters {
  language: string;
  category: Category | null;
  level: string;
  kind: KindFilter;
  sort: "new" | "popular";
  query: string;
  page: number;
  /** An AI topic tag to filter by (from a "More about" shelf); grid only. */
  topic?: string | null;
}

/** Filters the shelves ignore: they show every category, and have no search or topic. */
const GRID_ONLY = new Set(["category", "q", "topic"]);

/** The API path for Explore: shelves (front page, no paging/search) or one page of the filtered grid. */
export function exploreQuery(f: ExploreFilters, pageSize: number, shelves = false): string {
  const params = shelves ? new URLSearchParams() : new URLSearchParams({ sort: f.sort, page: String(f.page), size: String(pageSize) });
  const optional: [string, string | null | undefined][] = [
    ["language", f.language],
    ["category", f.category],
    ["level", f.level],
    ["kind", f.kind === "all" ? null : f.kind],
    ["q", f.query],
    ["topic", f.topic],
  ];
  for (const [key, value] of optional) if (value && !(shelves && GRID_ONLY.has(key))) params.set(key, value);
  const qs = params.toString();
  return (shelves ? "library/shelves" : "library") + (qs ? `?${qs}` : "");
}

/** Title and subtitle above Explore's grid: the search, else the topic, else the chosen category. */
export function gridHeading(query: string, category: Category | null, total: number | null, topic?: string | null): { title: string; subtitle: string } {
  const info = categoryInfo(category);
  if (!query) return topic ? topicHeading(topic, total) : { title: info?.label ?? "All", subtitle: info?.blurb ?? "" };
  if (total === null) return { title: `“${query}”`, subtitle: "Searching…" };
  const count = `${total} result${total === 1 ? "" : "s"}`;
  return { title: `“${query}”`, subtitle: info ? `${count} in ${info.label}` : count };
}

function topicHeading(topic: string, total: number | null): { title: string; subtitle: string } {
  if (total === null) return { title: topic, subtitle: `Items about ${topic}` };
  return { title: topic, subtitle: `${total} item${total === 1 ? "" : "s"} about ${topic}` };
}
