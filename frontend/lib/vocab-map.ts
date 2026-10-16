import type { VocabMap, VocabMapArea, VocabMapRegion, VocabMapWord, WordStatus } from "./types";

export const BANDS = ["A1", "A2", "B1", "B2", "C1"];

const LEVELS = [...BANDS, "C2"];

export function defaultTopBand(readingLevel: string | null, bands: string[]): string | null {
  if (bands.length === 0) return null;
  const level = readingLevel ? LEVELS.indexOf(readingLevel) : -1;
  return bands[Math.min(Math.max(level, 0), bands.length - 1)];
}

export function storedTopBand(stored: string | null, bands: string[]): string | null {
  return stored && bands.includes(stored) ? stored : null;
}

export function bandsUpTo(top: string, bands: string[]): string[] {
  return bands.slice(0, bands.indexOf(top) + 1);
}

export function nextBand(top: string, bands: string[]): { band: string; soon: boolean } | null {
  const band = BANDS[BANDS.indexOf(top) + 1];
  if (!band) return null;
  return { band, soon: !bands.includes(band) };
}

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
  total: number;
  next: number;
}

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

export function coverage(stats: TileStats): number {
  return stats.total === 0 ? 0 : Math.round((stats.known / stats.total) * 100);
}

export interface MapPlace {
  region: VocabMapRegion | null;
  area: VocabMapArea | null;
}

export function placeOf(param: string | null, map: VocabMap): MapPlace {
  const [regionId, areaId] = (param ?? "").split("/");
  const region = map.regions.find((r) => r.id === regionId) ?? null;
  const area = region?.areas.find((a) => a.id === areaId) ?? null;
  return { region, area };
}

export function placeParam(regionId: string | null, areaId: string | null = null): string | null {
  if (!regionId) return null;
  return areaId ? `${regionId}/${areaId}` : regionId;
}

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

const BAND_TARGET: Record<string, number> = { A1: 500, A2: 1000, B1: 2000, B2: 4000, C1: 8000 };
const RING_FITS = 2300;

export function ringScale(view: BandView): number {
  const widest = view.shown[view.shown.length - 1];
  return Math.min(1, Math.round(Math.sqrt((BAND_TARGET[widest] ?? RING_FITS) / RING_FITS) * 100) / 100);
}

export function drawnMap(map: VocabMap, view: BandView): VocabMap {
  const drawn = (w: VocabMapWord) => view.shown.includes(w.band);
  const regions = map.regions
    .map((r) => ({ ...r, areas: r.areas.map((a) => ({ ...a, words: a.words.filter(drawn) })).filter((a) => a.words.length > 0) }))
    .filter((r) => r.areas.length > 0);
  return { ...map, regions };
}

export function areaWords(area: VocabMapArea, shown: string[], next: string | null): { word: VocabMapWord; faint: boolean }[] {
  const counted = area.words.filter((w) => shown.includes(w.band)).map((word) => ({ word, faint: false }));
  const upcoming = area.words.filter((w) => w.band === next).map((word) => ({ word, faint: true }));
  return [...counted, ...upcoming];
}
