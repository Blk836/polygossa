// The vocabulary map on Progress (vocabulary-map.feature): which bands count, each tile's figures, and where the map is
// zoomed in. Pure helpers, unit-tested; the card in components/progress/vocab-map.tsx draws them.
import type { VocabMap, VocabMapArea, VocabMapRegion, VocabMapWord, WordStatus } from "./types";

/** The bands a word list can have, lowest first; a list's bands always start at A1 with none missing. */
export const BANDS = ["A1", "A2", "B1", "B2", "C1"];

const LEVELS = [...BANDS, "C2"];

/** The highest band counted by default: the learner's Reading level (A1 without one), within the bands the list has. */
export function defaultTopBand(readingLevel: string | null, bands: string[]): string | null {
  if (bands.length === 0) return null;
  const level = readingLevel ? LEVELS.indexOf(readingLevel) : -1;
  return bands[Math.min(Math.max(level, 0), bands.length - 1)];
}

/** A band stored on this device, if the list still has it; else null. */
export function storedTopBand(stored: string | null, bands: string[]): string | null {
  return stored && bands.includes(stored) ? stored : null;
}

/** The bands counted when the map counts up to {@code top}. */
export function bandsUpTo(top: string, bands: string[]): string[] {
  return bands.slice(0, bands.indexOf(top) + 1);
}

/** The band after {@code top}: one the list has, "soon" when the list stops there, or null after C1. */
export function nextBand(top: string, bands: string[]): { band: string; soon: boolean } | null {
  const band = BANDS[BANDS.indexOf(top) + 1];
  if (!band) return null;
  return { band, soon: !bands.includes(band) };
}

/** Which bands count, the next one shown faintly, or the next one still to come (no list yet). */
export interface BandView {
  shown: string[];
  next: string | null;
  soon: string | null;
}

export function bandView(top: string, bands: string[]): BandView {
  const next = nextBand(top, bands);
  return {
    shown: bandsUpTo(top, bands),
    next: next && !next.soon ? next.band : null,
    soon: next?.soon ? next.band : null,
  };
}

export interface TileStats {
  known: number;
  learning: number;
  /** Words counted (in the shown bands), ignored ones left out. */
  total: number;
  /** Words in the next band, for "+18 at B1". */
  next: number;
}

/** A tile's figures over these words: only shown bands count, and ignored words leave the total. */
export function tileStats(words: VocabMapWord[], shown: string[], next: string | null): TileStats {
  const stats: TileStats = { known: 0, learning: 0, total: 0, next: 0 };
  for (const w of words) {
    if (w.status === "ignored") continue;
    if (w.band === next) stats.next++;
    if (!shown.includes(w.band)) continue;
    stats.total++;
    if (w.status === "known") stats.known++;
    if (w.status === "learning") stats.learning++;
  }
  return stats;
}

export function regionWords(region: VocabMapRegion): VocabMapWord[] {
  return region.areas.flatMap((a) => a.words);
}

export function mapWords(map: VocabMap): VocabMapWord[] {
  return map.regions.flatMap(regionWords);
}

/** How full a tile looks, 0 to 100 (per cent known). */
export function coverage(stats: TileStats): number {
  return stats.total === 0 ? 0 : Math.round((stats.known / stats.total) * 100);
}

export interface MapPlace {
  region: VocabMapRegion | null;
  area: VocabMapArea | null;
}

/** Where "?map=food/fruit-veg" points on this map; unknown parts are dropped, so a stale link opens the whole map. */
export function placeOf(param: string | null, map: VocabMap): MapPlace {
  const [regionId, areaId] = (param ?? "").split("/");
  const region = map.regions.find((r) => r.id === regionId) ?? null;
  const area = region?.areas.find((a) => a.id === areaId) ?? null;
  return { region, area };
}

/** The "map" query value for a place: "food", "food/fruit-veg", or null for the whole map. */
export function placeParam(regionId: string | null, areaId: string | null = null): string | null {
  if (!regionId) return null;
  return areaId ? `${regionId}/${areaId}` : regionId;
}

/** The map with one word's status changed, as after "Start learning" or "I know this". */
export function withStatus(map: VocabMap, term: string, status: WordStatus): VocabMap {
  return {
    ...map,
    regions: map.regions.map((r) => ({
      ...r,
      areas: r.areas.map((a) => ({
        ...a,
        words: a.words.map((w) => (w.term === term ? { ...w, status } : w)),
      })),
    })),
  };
}

/** Words in the shown bands first, then the next band's (faint), each kept in list order. */
export function areaWords(area: VocabMapArea, shown: string[], next: string | null): { word: VocabMapWord; faint: boolean }[] {
  const counted = area.words.filter((w) => shown.includes(w.band)).map((word) => ({ word, faint: false }));
  const upcoming = area.words.filter((w) => w.band === next).map((word) => ({ word, faint: true }));
  return [...counted, ...upcoming];
}
