// What the vocabulary map's hex continent shows at a zoom (vocabulary-map.feature): country names far out, province
// names in an open country, words in a close province; each tile's colour; how far the map zooms; and where a ?map=
// place is. Pure and unit-tested (hex-world.test.ts, hex-view.test.ts).
import { hexPath } from "./hex-grid";
import { areaTiles, TILE, PLACE_MARGIN, type HexWorld } from "./hex-world";
import { fitBox, visibleRect, type Box, type Camera, type Limits, type Size } from "./map-camera";
import type { Point } from "./map-geometry";
import type { VocabMapRegion, VocabMapWord } from "./types";
import type { BandView } from "./vocab-map";

/** A tile's colour: a counted word's status, or the next band (pale) or a later one (paler still). */
export type TileKind = "known" | "learning" | "new" | "ignored" | "next" | "later";

export const TILE_KINDS: TileKind[] = ["known", "learning", "new", "ignored", "next", "later"];

export function tileKind(word: VocabMapWord, view: BandView): TileKind {
  if (!view.shown.includes(word.band)) return word.band === view.next ? "next" : "later";
  return word.status ?? "new";
}

/** Tiles are drawn a little smaller than their place, leaving grout between them. */
const GROUT = 0.9;

/** Every tile, as one path per kind: a handful of shapes to draw however many words the map has. */
export function tileLayers(world: HexWorld, regions: VocabMapRegion[], view: BandView): Record<TileKind, string> {
  const layers: Record<TileKind, string> = { known: "", learning: "", new: "", ignored: "", next: "", later: "" };
  const areas = new Map(regions.flatMap((r) => r.areas.map((a) => [a.id, a.words] as const)));
  for (const shape of world.countries.flatMap((c) => c.areas)) {
    for (const t of areaTiles(shape, areas.get(shape.areaId) ?? [])) layers[tileKind(t.word, view)] += hexPath(t, TILE, world.portrait, GROUT);
  }
  return layers;
}

/** Full-size tiles at these points, as one path: a country's or province's whole ground, to tap or click. */
export function groundOf(points: Point[], portrait: boolean): string {
  return points.map((p) => hexPath(p, TILE, portrait)).join("");
}

/** A country's name tag on a narrow map: where it sits on screen (its middle), and how much it matters (its size). */
export interface TagSpot {
  id: string;
  name: string;
  x: number;
  y: number;
  weight: number;
}

/** A tag in full (name and count), its name alone, or left out. */
export type TagShow = "full" | "name" | "hidden";

/** Roughly how much room a compact tag takes, in screen pixels (11px names, a 10px count chip below). */
const TAG = { letter: 6.3, line: 13, gap: 3, chip: { w: 56, h: 16 }, margin: 2 };

interface Rect { left: number; top: number; right: number; bottom: number }

function tagRect(s: TagSpot, show: TagShow): Rect {
  const lines = s.name.split(" & ").map((l, i, all) => (i < all.length - 1 ? `${l} &` : l));
  const w = Math.max(...lines.map((l) => l.length * TAG.letter), show === "full" ? TAG.chip.w : 0) + 2 * TAG.margin;
  const h = lines.length * TAG.line + (show === "full" ? TAG.gap + TAG.chip.h : 0) + 2 * TAG.margin;
  return { left: s.x - w / 2, right: s.x + w / 2, top: s.y - h / 2, bottom: s.y + h / 2 };
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * Which country tags a narrow map can show without any two overlapping: the biggest countries' first, in full; a
 * smaller one that would collide drops its count, and if its name still collides, is left out.
 */
export function fitTags(spots: TagSpot[]): Map<string, TagShow> {
  const placed: Rect[] = [];
  const out = new Map<string, TagShow>();
  for (const s of [...spots].sort((a, b) => b.weight - a.weight)) {
    const show = (["full", "name"] as const).find((v) => !placed.some((p) => overlaps(p, tagRect(s, v))));
    if (show) placed.push(tagRect(s, show));
    out.set(s.id, show ?? "hidden");
  }
  return out;
}

/** The width of a tile's writing space, and how wide a letter is for its size. */
const WRITING = TILE * 1.7 * 0.95;
const LETTER = 0.55;

/** The font size (in world units) that writes this word inside its tile: the same for short words, smaller for long. */
export function wordFontSize(term: string): number {
  return Math.min(TILE * 1.7 * 0.26, WRITING / (Math.max(term.length, 1) * LETTER));
}

/**
 * Once a country fills this share of the view (across or down, whichever is more), it counts as open: its provinces are
 * named. A province filling this share is close: its words are written in its tiles.
 */
const COUNTRY_OPEN = 0.5;
const AREA_CLOSE = 0.8;
/** A tile must be at least this many pixels across for its word to be written in it. */
const WORD_PX = 24;

export interface LabelPlan {
  countries: Set<string>;
  areas: Set<string>;
  /** Areas whose tiles have their words written in them. */
  words: Set<string>;
}

/** What to write at this zoom: country names far out, province names in an open country, words in a close province. */
export function labelPlan(world: HexWorld, cam: Camera, viewport: Size): LabelPlan {
  const plan: LabelPlan = { countries: new Set(), areas: new Set(), words: new Set() };
  const view = visibleRect(cam, viewport);
  const seen = (b: Box) => b.x + b.w >= view.left && b.x <= view.right && b.y + b.h >= view.top && b.y <= view.bottom;
  const fills = (b: Box) => Math.max((b.w * cam.k) / viewport.width, (b.h * cam.k) / viewport.height);
  for (const c of world.countries) {
    if (!seen(c.box)) continue;
    if (fills(c.box) < COUNTRY_OPEN) {
      plan.countries.add(c.regionId);
      continue;
    }
    for (const a of c.areas) {
      if (!seen(a.box)) continue;
      const close = fills(a.box) >= AREA_CLOSE && TILE * Math.sqrt(3) * cam.k >= WORD_PX;
      (close ? plan.words : plan.areas).add(a.areaId);
    }
  }
  return plan;
}

/** How far the map zooms: out to the whole world, in to its smallest province. */
export function zoomLimits(world: HexWorld, viewport: Size): Limits {
  const kMin = Math.min(viewport.width / world.width, viewport.height / world.height);
  const inner = world.countries.flatMap((c) => c.areas).map((a) => fitBox(a.box, viewport, PLACE_MARGIN).k);
  return { kMin, kMax: Math.max(kMin, ...inner) };
}

/** The country ("?map=food") or province ("food/fruit-veg") a place shows, or null for the whole world. */
export function placeBox(world: HexWorld, regionId: string | null, areaId: string | null): Box | null {
  const country = world.countries.find((c) => c.regionId === regionId);
  if (!country) return null;
  return country.areas.find((a) => a.areaId === areaId)?.box ?? country.box;
}
