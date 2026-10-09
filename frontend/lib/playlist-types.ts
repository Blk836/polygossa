import type { Category, LanguageCode, Person, TextSummary } from "./types";

export interface PlaylistCover {
  textId: number;
  title: string;
  thumbnailUrl?: string;
  category: Category;
}

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
  thumbnailUrl?: string;
  covers: PlaylistCover[];
  createdAt: string;
  updatedAt: string;
  containsText?: boolean;
  bookmarked: boolean;
}

export interface PlaylistDetail {
  playlist: PlaylistSummary;
  items: TextSummary[];
  privateItems: number;
}

export interface ReaderPlaylist {
  id: number;
  title: string;
  index: number;
  total: number;
  previous: { id: number; title: string } | null;
  next: { id: number; title: string } | null;
}
