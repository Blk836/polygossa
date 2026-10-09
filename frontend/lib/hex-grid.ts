// Hexagonal tiles for the vocabulary map's continent (vocabulary-map.feature): where a tile sits, its outline, the edge
// two tiles share, and territories grown tile by tile from seeds, so countries and provinces have organic borders.
// Pure and unit-tested; lib/hex-world.ts builds the continent from them. Axial coordinates (q, r); a landscape map uses
// pointy-topped tiles in rows, a portrait map the same layout turned on its side.
import { hashSeed, type Point } from "./map-geometry";

export interface Hex {
  q: number;
  r: number;
}

export const hexKey = (h: Hex) => `${h.q},${h.r}`;

/** The six neighbours of a tile, as (dq, dr) steps. */
export const NEIGHBOURS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const SQRT3 = Math.sqrt(3);

/** The middle of a tile of this size (centre-to-corner), on a landscape or portrait map. */
export function hexCentre(h: Hex, size: number, portrait: boolean): Point {
  const along = size * SQRT3 * (h.q + h.r / 2);
  const across = size * 1.5 * h.r;
  return portrait ? { x: across, y: along } : { x: along, y: across };
}

/** The tile a point falls in. */
export function nearestHex(p: Point, size: number, portrait: boolean): Hex {
  const { x, y } = portrait ? { x: p.y, y: p.x } : p;
  const r = y / (1.5 * size);
  const q = x / (size * SQRT3) - r / 2;
  let [rq, rr] = [Math.round(q), Math.round(r)];
  const rs = Math.round(-q - r);
  const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr - r), Math.abs(rs + q + r)];
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq + 0, r: rr + 0 };
}

const corner = (c: Point, size: number, angle: number): Point => ({ x: c.x + size * Math.cos(angle), y: c.y + size * Math.sin(angle) });
const num = (v: number) => String(Math.round(v * 10) / 10);

/** A tile's outline around its middle, shrunk by {@code scale} to leave grout between tiles. */
export function hexPath(c: Point, size: number, portrait: boolean, scale = 1): string {
  const start = portrait ? 0 : Math.PI / 6;
  const pts = [0, 1, 2, 3, 4, 5].map((i) => corner(c, size * scale, start + (i * Math.PI) / 3));
  return `M${pts.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}Z`;
}

/** The two corners of the edge tile {@code a} shares with its neighbour {@code b}. */
export function edgeBetween(a: Hex, b: Hex, size: number, portrait: boolean): [Point, Point] {
  const ca = hexCentre(a, size, portrait);
  const cb = hexCentre(b, size, portrait);
  const towards = Math.atan2(cb.y - ca.y, cb.x - ca.x);
  return [corner(ca, size, towards - Math.PI / 6), corner(ca, size, towards + Math.PI / 6)];
}

export interface Grower {
  id: string;
  seed: Hex;
  quota: number;
}

interface Growth extends Grower {
  /** Varies the wobble, for another try at the same layout. */
  salt: number;
  hexes: Hex[];
  frontier: Map<string, { hex: Hex; d: number }>;
}

/** How far a tile is from a grower's seed, with a little seeded wobble so borders aren't ruler-straight. */
function distance(h: Hex, g: Growth): number {
  const a = hexCentre(h, 1, false);
  const b = hexCentre(g.seed, 1, false);
  return Math.hypot(a.x - b.x, a.y - b.y) + (hashSeed(hexKey(h) + g.id + (g.salt || "")) % 100) / 180;
}

/** The grower furthest behind its quota (as a share), so territories grow at an even pace. */
function behind(growths: Growth[]): Growth | null {
  let best: Growth | null = null;
  for (const g of growths) {
    if (g.hexes.length >= g.quota) continue;
    if (!best || g.hexes.length / g.quota < best.hexes.length / best.quota) best = g;
  }
  return best;
}

function closest(pool: Hex[], g: Growth, free: (k: string) => boolean): Hex | null {
  let best: Hex | null = null;
  let bd = Infinity;
  for (const h of pool) {
    if (!free(hexKey(h))) continue;
    const d = distance(h, g);
    if (d < bd) [best, bd] = [h, d];
  }
  return best;
}

/** The tiles exactly {@code n} steps from a tile. */
function ring(c: Hex, n: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === n) out.push({ q: c.q + q, r: c.r + r });
    }
  }
  return out;
}

/** The free tile nearest a boxed-in grower's seed: among the allowed tiles, or searched ring by ring on an open grid. */
function nearestFree(g: Growth, free: (k: string) => boolean, allowed: Hex[] | undefined): Hex | null {
  if (allowed) return closest(allowed, g, free);
  for (let n = 1; n <= 200; n++) {
    const found = closest([...ring(g.seed, n), ...ring(g.seed, n + 1)], g, free);
    if (found) return found;
  }
  return null;
}

function nextHex(g: Growth, free: (k: string) => boolean, allowed: Hex[] | undefined): Hex | null {
  let best: { hex: Hex; d: number } | null = null;
  for (const [k, entry] of g.frontier) {
    if (!free(k)) g.frontier.delete(k);
    else if (!best || entry.d < best.d) best = entry;
  }
  return best?.hex ?? nearestFree(g, free, allowed); // boxed in: jump to the nearest free tile
}

const fromKey = (k: string): Hex => {
  const [q, r] = k.split(",").map(Number);
  return { q, r };
};
const around = (k: string) => NEIGHBOURS.map(([dq, dr]) => hexKey({ q: fromKey(k).q + dq, r: fromKey(k).r + dr }));

/** The connected pieces of a set of tiles, biggest first. */
function pieces(keys: Set<string>): string[][] {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const start of keys) {
    if (seen.has(start)) continue;
    const piece = [start];
    seen.add(start);
    for (let i = 0; i < piece.length; i++) {
      for (const n of around(piece[i])) {
        if (keys.has(n) && !seen.has(n)) {
          piece.push(n);
          seen.add(n);
        }
      }
    }
    out.push(piece);
  }
  return out.sort((a, b) => b.length - a.length);
}

/** How many separate pieces these tiles make. */
export function pieceCount(hexes: Hex[]): number {
  return pieces(new Set(hexes.map(hexKey))).length;
}


/**
 * Territories grown in turns from their seeds, nearest tiles first, until each has exactly its quota of tiles. With
 * {@code allowed}, only those tiles are shared out (their count must cover the quotas); otherwise the grid is open.
 */
export function growTerritories(growers: Grower[], allowed?: Hex[], salt = 0): Map<string, Hex[]> {
  const inside = allowed && new Set(allowed.map(hexKey));
  const taken = new Set<string>();
  const free = (k: string) => !taken.has(k) && (!inside || inside.has(k));
  const growths: Growth[] = growers.map((g) => ({ ...g, salt, hexes: [], frontier: new Map([[hexKey(g.seed), { hex: g.seed, d: 0 }]]) }));
  for (let g = behind(growths); g; g = behind(growths)) {
    const hex = nextHex(g, free, allowed);
    if (!hex) break;
    taken.add(hexKey(hex));
    g.frontier.delete(hexKey(hex));
    g.hexes.push(hex);
    for (const [dq, dr] of NEIGHBOURS) {
      const n = { q: hex.q + dq, r: hex.r + dr };
      if (free(hexKey(n)) && !g.frontier.has(hexKey(n))) g.frontier.set(hexKey(n), { hex: n, d: distance(n, g) });
    }
  }
  return new Map(growths.map((g) => [g.id, g.hexes]));
}
