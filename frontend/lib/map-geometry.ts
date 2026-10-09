// Drawing helpers for the vocabulary map's island world (vocabulary-map.feature): seeded randomness, so every shape is
// the same on every visit, circle packing for an island's provinces, sunflower placement for word dots, and wobbly
// closed curves for coastlines. Pure and unit-tested; lib/island-world.ts puts them together.

export interface Point {
  x: number;
  y: number;
}

export interface Circle extends Point {
  r: number;
}

/** FNV-1a: a string (a region or area id) to a 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Mulberry32: numbers in [0, 1), the same sequence for the same seed. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The two places a circle of radius r can touch both a and b from outside, if any. */
function touching(a: Circle, b: Circle, r: number): Point[] {
  const ra = a.r + r;
  const rb = b.r + r;
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d > ra + rb || d < Math.abs(ra - rb) || d === 0) return [];
  const along = (ra * ra - rb * rb + d * d) / (2 * d);
  const off = Math.sqrt(Math.max(0, ra * ra - along * along));
  const ux = (b.x - a.x) / d;
  const uy = (b.y - a.y) / d;
  const mx = a.x + ux * along;
  const my = a.y + uy * along;
  return [
    { x: mx - uy * off, y: my + ux * off },
    { x: mx + uy * off, y: my - ux * off },
  ];
}

function fits(p: Point, r: number, placed: Circle[]): boolean {
  return placed.every((c) => Math.hypot(p.x - c.x, p.y - c.y) >= c.r + r - 1e-6);
}

/** The free spot touching two placed circles that is nearest the origin, so the cluster stays round. */
function nextSpot(r: number, placed: Circle[]): Point {
  let best: Point | null = null;
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      for (const p of touching(placed[i], placed[j], r)) {
        if (fits(p, r, placed) && (!best || Math.hypot(p.x, p.y) < Math.hypot(best.x, best.y))) best = p;
      }
    }
  }
  return best ?? { x: placed[0].x + placed[0].r + r, y: placed[0].y };
}

/** Circles of these radii packed into a tight cluster, in the given order, centred on the origin. */
export function packCircles(radii: number[]): Circle[] {
  const placed: Circle[] = [];
  for (const r of radii) {
    if (placed.length === 0) placed.push({ x: 0, y: 0, r });
    else if (placed.length === 1) placed.push({ x: placed[0].r + r, y: 0, r });
    else placed.push({ ...nextSpot(r, placed), r });
  }
  const outer = enclose(placed);
  return placed.map((c) => ({ x: c.x - outer.x, y: c.y - outer.y, r: c.r }));
}

/** A circle around every circle, centred on the middle of their bounding box. */
export function enclose(circles: Circle[]): Circle {
  if (circles.length === 0) return { x: 0, y: 0, r: 0 };
  const left = Math.min(...circles.map((c) => c.x - c.r));
  const right = Math.max(...circles.map((c) => c.x + c.r));
  const top = Math.min(...circles.map((c) => c.y - c.r));
  const bottom = Math.max(...circles.map((c) => c.y + c.r));
  const x = (left + right) / 2;
  const y = (top + bottom) / 2;
  return { x, y, r: Math.max(...circles.map((c) => Math.hypot(c.x - x, c.y - y) + c.r)) };
}

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/** n evenly spread points filling a circle (a sunflower's seeds), the first ones in the middle. */
export function sunflower(n: number, circle: Circle, turn: number): Point[] {
  const points: Point[] = [];
  for (let i = 0; i < n; i++) {
    const d = circle.r * Math.sqrt((i + 0.5) / n);
    const a = i * GOLDEN_ANGLE + turn;
    points.push({ x: circle.x + d * Math.cos(a), y: circle.y + d * Math.sin(a) });
  }
  return points;
}

const num = (v: number) => String(Math.round(v * 10) / 10);

/** A closed, smooth curve wobbling around the circle by up to {@code wobble} of its radius: a coastline. */
export function blobPath(circle: Circle, wobble: number, seed: number, corners = 14): string {
  const random = seededRandom(seed);
  const pts: Point[] = [];
  for (let i = 0; i < corners; i++) {
    const a = (i / corners) * Math.PI * 2;
    const d = circle.r * (1 + wobble * (random() * 2 - 1));
    pts.push({ x: circle.x + d * Math.cos(a), y: circle.y + d * Math.sin(a) });
  }
  const at = (i: number) => pts[(i + corners) % corners];
  let path = `M${num(pts[0].x)} ${num(pts[0].y)}`;
  for (let i = 0; i < corners; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    path += ` C${num(c1.x)} ${num(c1.y)},${num(c2.x)} ${num(c2.y)},${num(p2.x)} ${num(p2.y)}`;
  }
  return `${path}Z`;
}
