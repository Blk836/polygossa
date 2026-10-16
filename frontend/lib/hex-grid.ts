import { hashSeed, type Point } from "./map-geometry";

export interface Hex {
  q: number;
  r: number;
}

export const hexKey = (h: Hex) => `${h.q},${h.r}`;

export const NEIGHBOURS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

const SQRT3 = Math.sqrt(3);

export function hexCentre(h: Hex, size: number, portrait: boolean): Point {
  const along = size * SQRT3 * (h.q + h.r / 2);
  const across = size * 1.5 * h.r;
  return portrait ? { x: across, y: along } : { x: along, y: across };
}

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

export function hexPath(c: Point, size: number, portrait: boolean, scale = 1): string {
  const start = portrait ? 0 : Math.PI / 6;
  const pts = [0, 1, 2, 3, 4, 5].map((i) => corner(c, size * scale, start + (i * Math.PI) / 3));
  return `M${pts.map((p) => `${num(p.x)} ${num(p.y)}`).join("L")}Z`;
}

export function edgeBetween(a: Hex, b: Hex, size: number, portrait: boolean): [Point, Point] {
  const ca = hexCentre(a, size, portrait);
  const cb = hexCentre(b, size, portrait);
  const towards = Math.atan2(cb.y - ca.y, cb.x - ca.x);
  return [corner(ca, size, towards - Math.PI / 6), corner(ca, size, towards + Math.PI / 6)];
}

export function outlinePath(hexes: Hex[], size: number, portrait: boolean, shift = (p: Point) => p): string {
  const own = new Set(hexes.map(hexKey));
  const at = (p: Point) => `${num(p.x)} ${num(p.y)}`;
  const from = new Map<string, string[]>();
  for (const h of hexes) {
    for (const [dq, dr] of NEIGHBOURS) {
      const n = { q: h.q + dq, r: h.r + dr };
      if (own.has(hexKey(n))) continue;
      const [p, q] = edgeBetween(h, n, size, portrait).map((c) => at(shift(c)));
      from.set(p, [...(from.get(p) ?? []), q]);
    }
  }
  let d = "";
  for (const start of from.keys()) {
    const loop: string[] = [];
    for (let p = start; from.get(p)?.length; ) {
      loop.push(p);
      p = from.get(p)!.pop()!;
    }
    if (loop.length) d += `M${loop.join("L")}Z`;
  }
  return d;
}

export interface Grower {
  id: string;
  seed: Hex;
  quota: number;
  pull?: Hex;
}

interface Growth extends Grower {
  salt: number;
  hexes: Hex[];
  frontier: Map<string, { hex: Hex; d: number }>;
}

const PULL = 1;

const apart = (a: Hex, b: Hex) => {
  const [p, q] = [hexCentre(a, 1, false), hexCentre(b, 1, false)];
  return Math.hypot(p.x - q.x, p.y - q.y);
};

function distance(h: Hex, g: Growth): number {
  const pull = g.pull ? PULL * apart(h, g.pull) : 0;
  return apart(h, g.seed) + pull + (hashSeed(hexKey(h) + g.id + (g.salt || "")) % 100) / 180;
}

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

function ring(c: Hex, n: number): Hex[] {
  const out: Hex[] = [];
  for (let q = -n; q <= n; q++) {
    for (let r = Math.max(-n, -q - n); r <= Math.min(n, -q + n); r++) {
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === n) out.push({ q: c.q + q, r: c.r + r });
    }
  }
  return out;
}

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
  return best?.hex ?? nearestFree(g, free, allowed);
}

const fromKey = (k: string): Hex => {
  const [q, r] = k.split(",").map(Number);
  return { q, r };
};
const around = (k: string) => NEIGHBOURS.map(([dq, dr]) => hexKey({ q: fromKey(k).q + dq, r: fromKey(k).r + dr }));

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

export function pieceCount(hexes: Hex[]): number {
  return pieces(new Set(hexes.map(hexKey))).length;
}


export function growTerritories(growers: Grower[], allowed?: Hex[], salt = 0, blocked?: Set<string>): Map<string, Hex[]> {
  const inside = allowed && new Set(allowed.map(hexKey));
  const taken = new Set<string>(blocked);
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
