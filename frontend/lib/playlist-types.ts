// Response types for /api/playlists, kept in sync with PlaylistDtos.
import type { Category, LanguageCode, Person, TextSummary } from "./types";

/** One of a playlist's first items, drawn as a card in its deck. */
export interface PlaylistCover {
  textId: number;
  title: string;
  /** Videos only. */
  thumbnailUrl?: string;
  category: Category;
}

/** Counts cover only the items the viewer can read. */
export interface PlaylistSummary {
  id: number;
  title: string;
  description?: string;
  language: LanguageCode;
  isPublic: boolean;
  owner: Person;
  mine: boolean;
  itemCount: number;
  completedCount: number;
  /** The first video item's thumbnail, if it has one. */
  thumbnailUrl?: string;
  /** The first few items the viewer can read. */
  covers: PlaylistCover[];
  createdAt: string;
  updatedAt: string;
  /** Only on `GET playlists?textId=`: whether this playlist holds that text. */
  containsText?: boolean;
  /** Whether the viewer saved it (Library > Saved). */
  bookmarked: boolean;
}

export interface PlaylistDetail {
  playlist: PlaylistSummary;
  items: TextSummary[];
  /** For the owner: items that are private, so others don't see them. */
  privateItems: number;
}

/** The reader's place in a playlist it was opened from (`/read/12?playlist=3`). */
export interface ReaderPlaylist {
  id: number;
  title: string;
  /** 0-based. */
  index: number;
  total: number;
  previous: { id: number; title: string } | null;
  next: { id: number; title: string } | null;
}
