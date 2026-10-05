// Playlist helpers: what to read next, where a text sits in its playlist, ordering and labels.
import type { PlaylistCover, PlaylistDetail, ReaderPlaylist } from "./playlist-types";
import type { TextSummary } from "./types";

const isFinished = (t: TextSummary) => t.progress?.completed === true;

/** The first item not finished yet; once all are finished, the first again. Null for an empty playlist. */
export function nextUp(items: TextSummary[]): TextSummary | null {
  return items.find((t) => !isFinished(t)) ?? items[0] ?? null;
}

/** The playlist's main button: nothing opened yet, part way through, or everything finished. */
export function startLabel(items: TextSummary[]): "Start" | "Continue" | "Read again" {
  if (items.length > 0 && items.every(isFinished)) return "Read again";
  return items.some((t) => t.progress) ? "Continue" : "Start";
}

export interface PlaylistPosition {
  index: number;
  total: number;
  previous: TextSummary | null;
  next: TextSummary | null;
}

/** Where a text sits in the playlist, with its neighbours; null when it isn't in it. */
export function positionIn(items: TextSummary[], textId: number): PlaylistPosition | null {
  const index = items.findIndex((t) => t.id === textId);
  if (index < 0) return null;
  return { index, total: items.length, previous: items[index - 1] ?? null, next: items[index + 1] ?? null };
}

const brief = (t: TextSummary | null) => (t ? { id: t.id, title: t.title } : null);

/** The reader's place in the playlist it was opened from; null without one, or when the text isn't in it. */
export function readerPlaylist(detail: PlaylistDetail | null, textId: number): ReaderPlaylist | null {
  const at = detail ? positionIn(detail.items, textId) : null;
  if (!detail || !at) return null;
  return {
    id: detail.playlist.id, title: detail.playlist.title, index: at.index, total: at.total,
    previous: brief(at.previous), next: brief(at.next),
  };
}

/** A copy of the list with the item at `index` swapped with its neighbour `delta` (±1) away; unchanged past an end. */
export function moveItem<T>(list: T[], index: number, delta: number): T[] {
  const target = index + delta;
  const out = [...list];
  if (target < 0 || target >= list.length) return out;
  [out[index], out[target]] = [out[target], out[index]];
  return out;
}

/** "5 items · 2 finished". */
export function itemsLabel({ itemCount, completedCount }: { itemCount: number; completedCount: number }): string {
  if (itemCount === 0) return "Empty";
  const count = `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  if (completedCount === 0) return count;
  return `${count} · ${completedCount === itemCount ? "all" : completedCount} finished`;
}

/** Opens a text in the reader as part of a playlist (for its position and the "next" link). */
export function playlistReadHref(textId: number, playlistId: number): string {
  return `/read/${textId}?playlist=${playlistId}`;
}

/** The reader's `?playlist=` search param as an id, or null. */
export function parsePlaylistParam(value: string | string[] | undefined): number | null {
  const id = Number(Array.isArray(value) ? value[0] : value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/** Where each card of a playlist's deck sits, front card straight and the ones behind fanned out to either side. */
const FAN = [
  { rotate: 0, shift: 0 },
  { rotate: 8, shift: 16 },
  { rotate: -8, shift: -16 },
];

export interface DeckCard {
  cover: PlaylistCover;
  /** Degrees. */
  rotate: number;
  /** Percent of the card's width, sideways. */
  shift: number;
}

/** The playlist's first items as a fanned deck, in drawing order (back first, so the first item ends up on top). */
export function deck(covers: PlaylistCover[]): DeckCard[] {
  return covers.slice(0, FAN.length).map((cover, i) => ({ cover, ...FAN[i] })).reverse();
}
