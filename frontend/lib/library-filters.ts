// The Library's filters: category chips in the bar above the cards, and the rest (texts or videos) behind one
// "Filters" button, Airbnb-style. Pure helpers, unit-tested.
import { categoryLabel } from "./categories";
import { languageName } from "./languages";
import type { KindFilter } from "./media";
import type { Category } from "./types";

export type LibraryView = "mine" | "saved";

export interface LibraryFilters {
  kind: KindFilter;
  category: Category | null;
}

export const NO_FILTERS: LibraryFilters = { kind: "all", category: null };

/** Filters set behind the Filters button (its badge); the category chips show their own state. */
export function extraFilterCount(f: LibraryFilters): number {
  return f.kind === "all" ? 0 : 1;
}

export function hasFilters(f: LibraryFilters): boolean {
  return f.category !== null || extraFilterCount(f) > 0;
}

/** The Filters panel's close button, Airbnb-style: "Show 23 items". */
export function showLabel(n: number): string {
  return `Show ${n} ${n === 1 ? "item" : "items"}`;
}

const WHAT: Record<KindFilter, string> = { all: "texts or videos", text: "texts", video: "videos" };

/** What an empty list says, naming the language, view and filters that emptied it. */
export function emptyTitle(view: LibraryView, f: LibraryFilters, language: string): string {
  const name = language ? `${languageName(language)} ` : "";
  const what = `${view === "saved" ? "saved " : ""}${name}${WHAT[f.kind]}`;
  if (f.category !== null) return `No ${what} in ${categoryLabel(f.category)}`;
  return view === "saved" ? `No ${what}` : `No ${what} yet`;
}
