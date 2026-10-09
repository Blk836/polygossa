// The vocabulary map's island world (vocabulary-map.feature): one island per region at a fixed place in a fixed sea, so
// the map looks like the same world in every language; a province per area inside it, sized by its words; a dot per
// word; and which labels to write at the current zoom. Pure and unit-tested; components/progress/island-map.tsx draws it.
import { fitCircle, visibleRect, type Camera, type Limits, type Rect, type Size } from "./map-camera";
import { blobPath, enclose, hashSeed, packCircles, sunflower, type Circle, type Point } from "./map-geometry";
import type { VocabMapArea, VocabMapRegion, VocabMapWord } from "./types";

/** The world as laid out for a landscape map; a portrait map (a phone) gets it turned on its side. */
export const WORLD: Size = { width: 1600, height: 1080 };

/** Where "Beyond the core" (known words outside the list) is written: the uncharted sea in the world's corner. */
const BEYOND: Point = { x: 150, y: 1010 };

/** The ring of themed islands around Core words, clockwise from the top. Changing it moves islands for everyone. */
const RING = ["people", "body", "food", "home", "shopping", "travel", "work", "nature", "time", "mind", "leisure", "society",
  "communication"];
const CENTRE: Point = { x: 800, y: 530 };
const RING_RADIUS = { x: 610, y: 375 };
/** Places for regions added to the blueprint later, until the layout gives them a spot in the ring. */
const SPARE: Point[] = [{ x: 1500, y: 110 }, { x: 100, y: 110 }, { x: 1500, y: 980 }];

/** Island sizes in province units (a province's radius is the square root of its words): gaps, beach and shallows. */
const GAP = 0.8;
const COAST = 1.6;
const SHALLOWS = 3.2;
/** World units kept clear between two islands' shallows, and around the edge and the uncharted sea. */
const SEA = 12;

export interface ProvinceShape {
  area: VocabMapArea;
  circle: Circle;
  /** The province's own outline. */
  land: string;
}

export interface IslandShape {
  region: VocabMapRegion;
  /** The land, beach included. */
  circle: Circle;
  /** The land and its shallow water, which no other island's shallows overlap. */
  shallows: Circle;
  provinces: ProvinceShape[];
  /** One beach outline per province: together they make the island's coastline. */
  coast: string[];
  /** The light water around the coast. */
  shallowsPaths: string[];
}

export interface World extends Size {
  islands: IslandShape[];
  /** Where the uncharted sea ("Beyond the core") is. */
  beyond: Point;
}

const onRing = (a: number): Point => ({ x: CENTRE.x + RING_RADIUS.x * Math.cos(a), y: CENTRE.y + RING_RADIUS.y * Math.sin(a) });

/** Places evenly spaced along the ring (by distance, not angle, which would crowd its narrow ends), from the top. */
const RING_PLACES: Point[] = (() => {
  const steps = 3600;
  const along = [0];
  for (let s = 1; s <= steps; s++) {
    const a = -Math.PI / 2 + (s / steps) * Math.PI * 2;
    const b = -Math.PI / 2 + ((s - 1) / steps) * Math.PI * 2;
    along.push(along[s - 1] + Math.hypot(onRing(a).x - onRing(b).x, onRing(a).y - onRing(b).y));
  }
  const total = along[steps];
  return RING.map((_, i) => {
    const s = along.findIndex((d) => d >= (i / RING.length) * total);
    return onRing(-Math.PI / 2 + (s / steps) * Math.PI * 2);
  });
})();

/** The fixed centre of a region's island. */
function slot(id: string, spareIndex: number): Point {
  if (id === "core") return CENTRE;
  const i = RING.indexOf(id);
  return i < 0 ? SPARE[spareIndex % SPARE.length] : RING_PLACES[i];
}

interface Draft {
  region: VocabMapRegion;
  at: Point;
  /** Province circles in province units, around the island's middle. */
  packed: Circle[];
  /** Radius of land and shallows in province units. */
  outer: number;
}

function draft(region: VocabMapRegion, at: Point): Draft {
  const radii = region.areas.map((a) => Math.sqrt(Math.max(a.words.length, 1)));
  const order = radii.map((_, i) => i).sort((a, b) => radii[b] - radii[a]);
  const packedSorted = packCircles(order.map((i) => radii[i] + GAP / 2));
  const packed: Circle[] = [];
  order.forEach((i, n) => (packed[i] = { ...packedSorted[n], r: radii[i] }));
  return { region, at, packed, outer: enclose(packedSorted).r + COAST + SHALLOWS };
}

/** The largest scale (world units per province unit) at which no island's shallows touch another, the edge or the sea. */
function fitScale(drafts: Draft[], size: Size, beyond: Point): number {
  let scale = Infinity;
  drafts.forEach((a, i) => {
    const edge = Math.min(a.at.x, size.width - a.at.x, a.at.y, size.height - a.at.y) - SEA;
    const sea = Math.hypot(a.at.x - beyond.x, a.at.y - beyond.y) - 6 * SEA;
    scale = Math.min(scale, edge / a.outer, sea / a.outer);
    for (const b of drafts.slice(i + 1)) {
      scale = Math.min(scale, (Math.hypot(a.at.x - b.at.x, a.at.y - b.at.y) - SEA) / (a.outer + b.outer));
    }
  });
  return scale;
}

function island(d: Draft, scale: number): IslandShape {
  const provinces = d.region.areas.map((area, i) => {
    const p = d.packed[i];
    const circle = { x: d.at.x + p.x * scale, y: d.at.y + p.y * scale, r: p.r * scale };
    return { area, circle, land: blobPath(circle, 0.05, hashSeed(area.id)) };
  });
  const around = (extra: number, wobble: number, salt: string) =>
    provinces.map((p) => blobPath({ ...p.circle, r: p.circle.r + extra * scale }, wobble, hashSeed(p.area.id + salt)));
  const land = enclose(provinces.map((p) => p.circle));
  return {
    region: d.region,
    circle: { ...land, r: land.r + COAST * scale * 1.1 },
    shallows: { x: d.at.x, y: d.at.y, r: d.outer * scale },
    provinces,
    coast: around(COAST, 0.08, "coast"),
    shallowsPaths: around(COAST + SHALLOWS * 0.75, 0.1, "shallows"),
  };
}

/**
 * The world for this map: islands at their fixed places, scaled together so the biggest still fit. A portrait map gets
 * the world turned on its side (every place mirrored across the diagonal), so a phone's tall screen isn't mostly sea.
 */
export function layoutWorld(regions: VocabMapRegion[], portrait = false): World {
  const turn = (p: Point): Point => (portrait ? { x: p.y, y: p.x } : p);
  const size = portrait ? { width: WORLD.height, height: WORLD.width } : WORLD;
  const beyond = turn(BEYOND);
  let spare = 0;
  const drafts = regions.map((r) => draft(r, turn(slot(r.id, RING.includes(r.id) || r.id === "core" ? 0 : spare++))));
  const scale = fitScale(drafts, size, beyond);
  return { ...size, beyond, islands: drafts.map((d) => island(d, scale)) };
}

/** Room left around an island or province the map is zoomed into, as a share of its size. */
export const PLACE_MARGIN = 0.06;

/** How far the map zooms: out to the whole world, in to its smallest province. */
export function zoomLimits(world: World, viewport: Size): Limits {
  const kMin = Math.min(viewport.width / world.width, viewport.height / world.height);
  const smallest = Math.min(...world.islands.flatMap((i) => i.provinces.map((p) => p.circle.r)));
  return { kMin, kMax: Math.max(kMin, fitCircle({ x: 0, y: 0, r: smallest }, viewport, PLACE_MARGIN).k) };
}

/** The island ("?map=food") or province ("food/fruit-veg") a place shows, or null for the whole world. */
export function placeCircle(world: World, regionId: string | null, areaId: string | null): Circle | null {
  const isle = world.islands.find((i) => i.region.id === regionId);
  if (!isle) return null;
  return isle.provinces.find((p) => p.area.id === areaId)?.circle ?? isle.circle;
}

export interface Dot extends Point {
  word: VocabMapWord;
  faint: boolean;
}

/** A dot per word, spread evenly over the province, the counted words in the middle and the next band's round them. */
export function provinceDots(province: ProvinceShape, words: { word: VocabMapWord; faint: boolean }[]): { dots: Dot[]; spacing: number } {
  const inner = { ...province.circle, r: province.circle.r * 0.86 };
  const turn = (hashSeed(province.area.id) % 628) / 100;
  const points = sunflower(words.length, inner, turn);
  const spacing = inner.r * Math.sqrt(Math.PI / Math.max(words.length, 1));
  return { dots: words.map((w, i) => ({ ...points[i], ...w })), spacing };
}

/** Below these on-screen sizes a label would be unreadable: word labels need this much room between dots. */
const WORD_PX = 30;
/** An island counts as zoomed into once it is this share of the viewport's smaller side across; a province likewise. */
const ISLAND_SHARE = 0.3;
const PROVINCE_SHARE = 0.25;

export interface LabelPlan {
  /** Region ids whose island is named, with its counts. */
  islands: Set<string>;
  /** Area ids whose province is named. */
  provinces: Set<string>;
  /** Area ids whose dots have their words written beside them. */
  words: Set<string>;
}

function inView(c: Circle, view: Rect): boolean {
  return c.x + c.r >= view.left && c.x - c.r <= view.right && c.y + c.r >= view.top && c.y - c.r <= view.bottom;
}

/** What to write at this zoom: island names far out, province names over an island, words over a province. */
export function labelPlan(world: World, cam: Camera, viewport: Size, spacingOf: (areaId: string) => number): LabelPlan {
  const plan: LabelPlan = { islands: new Set(), provinces: new Set(), words: new Set() };
  const view = visibleRect(cam, viewport);
  const side = Math.min(viewport.width, viewport.height);
  for (const isle of world.islands) {
    if (!inView(isle.circle, view)) continue;
    if (isle.circle.r * cam.k < side * ISLAND_SHARE) {
      plan.islands.add(isle.region.id);
      continue;
    }
    for (const p of isle.provinces) {
      if (!inView(p.circle, view)) continue;
      const close = p.circle.r * cam.k >= side * PROVINCE_SHARE && spacingOf(p.area.id) * cam.k >= WORD_PX;
      (close ? plan.words : plan.provinces).add(p.area.id);
    }
  }
  return plan;
}
