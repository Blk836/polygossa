import { edgeBetween, growTerritories, hexCentre, hexKey, hexPath, NEIGHBOURS, nearestHex, outlinePath, pieceCount, type Hex } from "./hex-grid";
import { mendTerritories } from "./hex-mend";
import type { Box, Size } from "./map-camera";
import { hashSeed, type Point } from "./map-geometry";
import type { VocabMapRegion, VocabMapWord } from "./types";

export const TILE = 10;
export const PLACE_MARGIN = 0.06;

const RING = ["people", "body", "food", "home", "shopping", "travel", "work", "nature", "time", "mind", "leisure", "society",
  "communication"];
const RING_RADIUS = { x: 340, y: 230 };
const SPARE: Point[] = [{ x: 0, y: -540 }, { x: 760, y: 0 }, { x: 0, y: 540 }, { x: -760, y: 0 }];
const ASPECT = { landscape: 16 / 10, portrait: 2 / 3 };
const SEA = TILE * 5;

export interface AreaShape {
  areaId: string;
  hexes: Hex[];
  slots: Point[];
  centre: Point;
  labelAt: Point;
  box: Box;
  outline: string;
}

export interface CountryShape {
  regionId: string;
  seed: Hex;
  areas: AreaShape[];
  centre: Point;
  labelAt: Point;
  labelSpots: Point[];
  box: Box;
  outline: string;
}

export interface HexWorld extends Size {
  portrait: boolean;
  countries: CountryShape[];
  beyond: Point;
  ground: string;
  land: string;
  borders: { coast: string; countries: string; areas: string };
}

const RING_PLACES: Point[] = (() => {
  const on = (a: number): Point => ({ x: RING_RADIUS.x * Math.cos(a), y: RING_RADIUS.y * Math.sin(a) });
  const steps = 3600;
  const along = [0];
  for (let s = 1; s <= steps; s++) {
    const [a, b] = [on(-Math.PI / 2 + (s / steps) * 2 * Math.PI), on(-Math.PI / 2 + ((s - 1) / steps) * 2 * Math.PI)];
    along.push(along[s - 1] + Math.hypot(a.x - b.x, a.y - b.y));
  }
  return RING.map((_, i) => on(-Math.PI / 2 + (along.findIndex((d) => d >= (i / RING.length) * along[steps]) / steps) * 2 * Math.PI));
})();

function seedOf(id: string, spare: () => number, scale: number): Hex {
  const i = RING.indexOf(id);
  const place = id === "core" ? { x: 0, y: 0 } : i >= 0 ? RING_PLACES[i] : SPARE[spare() % SPARE.length];
  return nearestHex({ x: place.x * scale, y: place.y * scale }, TILE, false);
}

const mean = (pts: Point[]): Point => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

function areaSeeds(hexes: Hex[], count: number, at: (h: Hex) => Point, salt: number): Hex[] {
  const middle = mean(hexes.map(at));
  const seeds: Hex[] = [];
  for (let n = 0; n < count; n++) {
    let best = hexes[0];
    let score = -Infinity;
    for (const h of hexes) {
      const p = at(h);
      const fromMiddle = Math.hypot(p.x - middle.x, p.y - middle.y);
      const apart = seeds.length ? Math.min(...seeds.map((s) => Math.hypot(p.x - at(s).x, p.y - at(s).y))) : 0;
      const nudge = salt ? ((hashSeed(hexKey(h) + salt) % 100) / 100) * TILE * 3 : 0;
      const s = (seeds.length ? apart - fromMiddle * 0.15 : -fromMiddle) + nudge;
      if (s > score && !seeds.some((x) => hexKey(x) === hexKey(h))) [best, score] = [h, s];
    }
    seeds.push(best);
  }
  return seeds;
}

function boxAround(pts: Point[]): Box {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [x, y] = [Math.min(...xs) - TILE, Math.min(...ys) - TILE];
  return { x, y, w: Math.max(...xs) + TILE - x, h: Math.max(...ys) + TILE - y };
}

interface Raw {
  region: VocabMapRegion;
  seed: Hex;
  areas: { areaId: string; hexes: Hex[] }[];
}

const MIDDLE = "core";

function grow(regions: VocabMapRegion[], portrait: boolean, scale: number): Raw[] {
  let spare = 0;
  const quota = (r: VocabMapRegion) => Math.max(1, r.areas.reduce((s, a) => s + Math.max(a.words.length, 1), 0));
  const seeds = regions.map((r) => seedOf(r.id, () => spare++, scale));
  const grower = (r: VocabMapRegion, i: number) => ({ id: r.id, seed: seeds[i], quota: quota(r) });
  const middle = growTerritories(regions.flatMap((r, i) => (r.id === MIDDLE ? [grower(r, i)] : [])));
  const blocked = new Set([...middle.values()].flat().map(hexKey));
  const centre = nearestHex({ x: 0, y: 0 }, TILE, false);
  const ring = growTerritories(regions.flatMap((r, i) => (r.id === MIDDLE ? [] : [{ ...grower(r, i), pull: centre }])), undefined, 0, blocked);
  const countries = mendTerritories(new Map([...middle, ...ring]));
  const at = (h: Hex) => hexCentre(h, TILE, portrait);
  return regions.map((region, i) => {
    const provinces = provincesOf(region, countries.get(region.id) ?? [], at);
    return { region, seed: seeds[i], areas: region.areas.map((a) => ({ areaId: a.id, hexes: provinces.get(a.id) ?? [] })) };
  });
}

const TRIES = 8;

function provincesOf(region: VocabMapRegion, hexes: Hex[], at: (h: Hex) => Point): Map<string, Hex[]> {
  const order = region.areas.map((_, n) => n).sort((a, b) => region.areas[b].words.length - region.areas[a].words.length);
  let best = new Map<string, Hex[]>();
  let bestBroken = Infinity;
  for (let salt = 0; salt < TRIES && bestBroken > 0; salt++) {
    const picks = areaSeeds(hexes, region.areas.length, at, salt);
    const growers = order.map((n, j) => ({ id: region.areas[n].id, seed: picks[j], quota: Math.max(region.areas[n].words.length, 1) }));
    const provinces = mendTerritories(growTerritories(growers, hexes, salt));
    const broken = [...provinces.values()].reduce((s, h) => s + Math.max(0, pieceCount(h) - 1), 0);
    if (broken < bestBroken) [best, bestBroken] = [provinces, broken];
  }
  return best;
}

interface Edges {
  lines: HexWorld["borders"];
  countries: string[];
  areas: string[][];
}

function fileEdge(out: Edges, d: string, mine: [number, number], other: [number, number] | undefined, first: boolean) {
  const [ci, ai] = mine;
  const country = !other || other[0] !== ci;
  if (country) out.countries[ci] += d;
  if (country || other[1] !== ai) out.areas[ci][ai] += d;
  const line = !other ? "coast" : !first ? null : country ? "countries" : "areas";
  if (line) out.lines[line] += d;
}

function edges(raw: Raw[], portrait: boolean, shift: (p: Point) => Point): Edges {
  const owner = new Map<string, [number, number]>();
  raw.forEach((c, ci) => c.areas.forEach((a, ai) => a.hexes.forEach((h) => owner.set(hexKey(h), [ci, ai]))));
  const out: Edges = { lines: { coast: "", countries: "", areas: "" }, countries: raw.map(() => ""), areas: raw.map((c) => c.areas.map(() => "")) };
  const seg = ([p, q]: [Point, Point]) => {
    const [a, b] = [shift(p), shift(q)];
    return `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  };
  for (const [key, mine] of owner) {
    const [q, r] = key.split(",").map(Number);
    for (const [dq, dr] of NEIGHBOURS) {
      const n = { q: q + dq, r: r + dr };
      const other = owner.get(hexKey(n));
      if (other && other[0] === mine[0] && other[1] === mine[1]) continue;
      fileEdge(out, seg(edgeBetween({ q, r }, n, TILE, portrait)), mine, other, key < hexKey(n));
    }
  }
  return out;
}

function openSea(size: Size, tiles: Point[]): Point {
  const inset = TILE * 9;
  const corners = [{ x: inset, y: size.height - inset }, { x: size.width - inset, y: size.height - inset }, { x: inset, y: inset },
    { x: size.width - inset, y: inset }];
  const clear = (c: Point) => Math.min(...tiles.map((t) => Math.hypot(t.x - c.x, t.y - c.y)));
  return corners.reduce((best, c) => (clear(c) > clear(best) + 1e-6 ? c : best));
}

function byDepth(hexes: Hex[]): Hex[] {
  const own = new Set(hexes.map(hexKey));
  const depth = new Map<string, number>();
  let ring = hexes.filter((h) => NEIGHBOURS.some(([dq, dr]) => !own.has(hexKey({ q: h.q + dq, r: h.r + dr }))));
  for (let d = 0; ring.length > 0; d++) {
    for (const h of ring) depth.set(hexKey(h), d);
    const next = new Map<string, Hex>();
    for (const h of ring) {
      for (const [dq, dr] of NEIGHBOURS) {
        const n = { q: h.q + dq, r: h.r + dr };
        if (own.has(hexKey(n)) && !depth.has(hexKey(n))) next.set(hexKey(n), n);
      }
    }
    ring = [...next.values()];
  }
  return hexes.map((h, i) => ({ h, i, d: depth.get(hexKey(h))! })).sort((a, b) => b.d - a.d || a.i - b.i).map((x) => x.h);
}

const LABEL_SPOTS = 40;

function build(regions: VocabMapRegion[], portrait: boolean, scale: number): HexWorld {
  const raw = grow(regions, portrait, scale);
  const centres = raw.flatMap((c) => c.areas.flatMap((a) => a.hexes.map((h) => hexCentre(h, TILE, portrait))));
  const box = boxAround(centres);
  const aspect = portrait ? ASPECT.portrait : ASPECT.landscape;
  const height = Math.max(box.h + 2 * SEA, (box.w + 2 * SEA) / aspect);
  const width = height * aspect;
  const shift = (p: Point): Point => ({ x: p.x - box.x + (width - box.w) / 2, y: p.y - box.y + (height - box.h) / 2 });
  const at = (h: Hex) => shift(hexCentre(h, TILE, portrait));
  const lines = edges(raw, portrait, shift);
  const countries = raw.map((c, ci) => {
    const areas = c.areas.map(({ areaId, hexes }, ai) => {
      const centre = mean(hexes.map(at));
      const d = (h: Hex) => Math.hypot(at(h).x - centre.x, at(h).y - centre.y);
      const sorted = [...hexes].sort((a, b) => d(a) - d(b) || (hexKey(a) < hexKey(b) ? -1 : 1));
      const slots = sorted.map(at);
      return { areaId, hexes: sorted, slots, centre, labelAt: at(byDepth(sorted)[0]), box: boxAround(slots), outline: lines.areas[ci][ai] };
    });
    const all = areas.flatMap((a) => a.slots);
    const middle = mean(all);
    const fromMiddle = (h: Hex) => Math.hypot(at(h).x - middle.x, at(h).y - middle.y);
    const labelSpots = byDepth(areas.flatMap((a) => a.hexes).sort((a, b) => fromMiddle(a) - fromMiddle(b))).slice(0, LABEL_SPOTS).map(at);
    return { regionId: c.region.id, seed: c.seed, areas, centre: middle, labelAt: labelSpots[0], labelSpots, box: boxAround(all), outline: lines.countries[ci] };
  });
  const tiles = countries.flatMap((c) => c.areas.flatMap((a) => a.slots));
  return {
    width,
    height,
    portrait,
    countries,
    beyond: openSea({ width, height }, tiles),
    ground: tiles.map((t) => hexPath(t, TILE, portrait)).join(""),
    land: outlinePath(raw.flatMap((c) => c.areas.flatMap((a) => a.hexes)), TILE, portrait, shift),
    borders: lines.lines,
  };
}

const cache = new Map<string, HexWorld>();
const CACHED = 12;

export function layoutHexWorld(regions: VocabMapRegion[], portrait: boolean, ringScale = 1): HexWorld {
  const shape = `${portrait}|${ringScale}|${regions.map((r) => `${r.id}:${r.areas.map((a) => `${a.id}=${a.words.length}`).join(",")}`).join("|")}`;
  const world = cache.get(shape) ?? build(regions, portrait, ringScale);
  cache.delete(shape);
  cache.set(shape, world);
  if (cache.size > CACHED) cache.delete(cache.keys().next().value!);
  return world;
}

const BAND_ORDER = ["A1", "A2", "B1", "B2", "C1"];
const bandRank = (w: VocabMapWord) => (BAND_ORDER.includes(w.band) ? BAND_ORDER.indexOf(w.band) : BAND_ORDER.length);

export function areaTiles(shape: AreaShape, words: VocabMapWord[]): (Point & { word: VocabMapWord })[] {
  const order = words.map((w, i) => ({ w, i })).sort((a, b) => bandRank(a.w) - bandRank(b.w) || a.i - b.i);
  return order.slice(0, shape.slots.length).map(({ w }, i) => ({ ...shape.slots[i], word: w }));
}
