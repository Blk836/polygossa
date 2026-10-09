// My library's filters: category chips in the bar above the cards, and the rest (texts or videos, imported or saved)
// behind one "Filters" button, Airbnb-style. My library lists your imports and your saved items together; these
// combine and filter them. Pure helpers, unit-tested.
import { categoryLabel } from "./categories";
import { languageName } from "./languages";
import { KIND_FILTERS, type KindFilter } from "./media";
import type { Category } from "./types";

export type SourceFilter = "all" | "imported" | "saved";

export const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "imported", label: "Imported" },
  { id: "saved", label: "Saved" },
];

export interface LibraryFilters {
  kind: KindFilter;
  category: Category | null;
  source: SourceFilter;
}

export const NO_FILTERS: LibraryFilters = { kind: "all", category: null, source: "all" };

/** `?source=` on /library (old links to Saved land on it); anything unknown shows everything. */
export function sourceFromParam(param: string | string[] | undefined): SourceFilter {
  const value = Array.isArray(param) ? param[0] : param;
  return SOURCE_FILTERS.find((s) => s.id === value)?.id ?? "all";
}

/** Filters set behind the Filters button (its badge); the category chips show their own state. */
export function extraFilterCount(f: LibraryFilters): number {
  return (f.kind === "all" ? 0 : 1) + (f.source === "all" ? 0 : 1);
}

export function hasFilters(f: LibraryFilters): boolean {
  return f.category !== null || extraFilterCount(f) > 0;
}

/** A pill per filter set behind the button, and the filters left when it is removed. */
export function filterPills(f: LibraryFilters): { label: string; without: LibraryFilters }[] {
  const pills = [];
  if (f.kind !== "all") pills.push({ label: KIND_FILTERS.find((k) => k.id === f.kind)!.label, without: { ...f, kind: "all" as const } });
  if (f.source !== "all") pills.push({ label: SOURCE_FILTERS.find((s) => s.id === f.source)!.label, without: { ...f, source: "all" as const } });
  return pills;
}

/** The Filters panel's close button, Airbnb-style: "Show 23 items". */
export function showLabel(n: number): string {
  return `Show ${n} ${n === 1 ? "item" : "items"}`;
}

const WHAT: Record<KindFilter, string> = { all: "texts or videos", text: "texts", video: "videos" };

/** What an empty list says, naming the language and filters that emptied it. */
export function emptyTitle(f: LibraryFilters, language: string): string {
  const name = language ? `${languageName(language)} ` : "";
  const what = `${f.source === "all" ? "" : f.source + " "}${name}${WHAT[f.kind]}`;
  if (f.category !== null) return `No ${what} in ${categoryLabel(f.category)}`;
  return f.source === "all" ? `No ${what} yet` : `No ${what}`;
}

/** The first list, then the second's items that aren't in it (your own text you also saved is listed once, as yours). */
export function uniqueById<T extends { id: number }>(first: T[], second: T[]): T[] {
  const ids = new Set(first.map((x) => x.id));
  return [...first, ...second.filter((x) => !ids.has(x.id))];
}

/** The items the source and category let through (the type is filtered by the server). */
export function shownItems<T extends { mine: boolean; category: Category }>(items: T[], f: LibraryFilters): T[] {
  return items.filter(
    (t) => (f.source === "all" || (f.source === "imported") === t.mine) && (f.category === null || t.category === f.category),
  );
}

/** Under My library's heading: the free plan's import count (saved items don't count), or what the page holds. */
export function librarySubtitle(used: number, limit: number | null, language: string): string {
  if (limit !== null) return `${used} of ${limit} imported texts and videos on the free plan (all languages). Saved items don't count.`;
  return language ? `${languageName(language)} texts and videos you imported or saved` : "Texts and videos you imported or saved";
}
