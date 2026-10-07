// Explore's personalised shelves (GET /api/recommendations): types, headings, card reasons and the events logged.
import { categoryLabel } from "./categories";
import type { Category, TextSummary } from "./types";

export type ShelfId = "continue" | "for-you" | "because" | "topic" | "just-right" | "stretch";

export type ReasonKind =
  | "progress" | "known" | "because" | "topic" | "category" | "level" | "popular" | "new" | "similar" | "explore";

/** Why a card is on its shelf; which fields are set depends on the kind. */
export interface Reason {
  kind: ReasonKind;
  percent?: number;
  topic?: string;
  category?: Category;
  title?: string;
  liked?: boolean;
  level?: string;
  likes?: number;
}

/** A ranked card's unweighted score parts, logged back with its impression so weights can be learned. */
export interface ScoreParts {
  interest: number;
  topic: number;
  comprehension: number;
  level: number;
  popular: number;
  fresh: number;
  format: number;
}

export interface RecommendedItem {
  text: TextSummary;
  reason: Reason;
  /** Absent on Continue reading, which isn't ranked. */
  parts?: ScoreParts;
}

export interface RecommendedShelf {
  id: ShelfId;
  /** "More about" shelves: a topic tag, or a category when no tag fits. */
  topic?: string;
  category?: Category;
  /** "Because you read" shelves: the text read or liked. */
  anchor?: { id: number; title: string; liked: boolean };
  items: RecommendedItem[];
}

export interface Recommendations {
  language?: string;
  shelves: RecommendedShelf[];
}

/** A batch of shown or opened cards, as POST recommendations/events takes it. */
export interface RecommendationEvent {
  type: "impression" | "open";
  shelf: ShelfId;
  items: { textId: number; position: number; parts?: ScoreParts }[];
}

/** Interests asked for during onboarding before they can be saved. */
export const INTEREST_MINIMUM = 3;

export function recommendationsPath(language: string): string {
  return language ? `recommendations?language=${language}` : "recommendations";
}

const SUBTITLES: Record<ShelfId, string> = {
  continue: "Pick up where you left off",
  "for-you": "Picked from what you read, what you know and what you like",
  because: "More like something you enjoyed",
  topic: "One of your favourite subjects",
  "just-right": "You know 90–98% of the words: ideal for learning new ones",
  stretch: "A little harder (85–90% known), in subjects you like",
};

export function shelfHeading(shelf: RecommendedShelf): { title: string; subtitle: string } {
  return { title: shelfTitle(shelf), subtitle: SUBTITLES[shelf.id] };
}

function shelfTitle(shelf: RecommendedShelf): string {
  switch (shelf.id) {
    case "continue": return "Continue reading";
    case "for-you": return "For you";
    case "because": return shelf.anchor ? `Because you ${shelf.anchor.liked ? "liked" : "read"} ${shelf.anchor.title}` : "Because you read this";
    case "topic": return `More about ${shelf.topic ?? categoryLabel(shelf.category)}`;
    case "just-right": return "Just right for you";
    case "stretch": return "Stretch";
  }
}

const REASONS: Record<ReasonKind, (r: Reason) => string> = {
  progress: (r) => `${r.percent ?? 0}% read`,
  known: (r) => `${r.percent ?? 0}% known words`,
  because: (r) => (r.title ? `Because you ${r.liked ? "liked" : "read"} ${r.title}` : "Because you read something similar"),
  topic: (r) => (r.topic ? `You like ${r.topic}` : "You like this subject"),
  category: (r) => `You like ${categoryLabel(r.category)}`,
  level: (r) => (r.level ? `At your level (${r.level})` : "At your level"),
  popular: (r) => `${r.likes ?? 0} ${r.likes === 1 ? "like" : "likes"} this month`,
  new: () => "New",
  similar: () => "Like what you enjoy",
  explore: () => "Something different",
};

/** The short line under a recommended card ("" for a kind this version doesn't know). */
export function reasonLabel(r: Reason): string {
  return REASONS[r.kind]?.(r) ?? "";
}

/** One impression batch per shelf with cards, each card at its position. */
export function impressionBatches(shelves: RecommendedShelf[]): RecommendationEvent[] {
  return shelves
    .filter((s) => s.items.length > 0)
    .map((s) => ({
      type: "impression",
      shelf: s.id,
      items: s.items.map((it, position) => (it.parts ? { textId: it.text.id, position, parts: it.parts } : { textId: it.text.id, position })),
    }));
}

export function openEvent(shelf: ShelfId, textId: number, position: number): RecommendationEvent {
  return { type: "open", shelf, items: [{ textId, position }] };
}

/** The shelves without this item ("Not interested"); shelves left empty go too. */
export function withoutItem(shelves: RecommendedShelf[], textId: number): RecommendedShelf[] {
  return shelves
    .map((s) => ({ ...s, items: s.items.filter((it) => it.text.id !== textId) }))
    .filter((s) => s.items.length > 0);
}
