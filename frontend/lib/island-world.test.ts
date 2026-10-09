import { describe, expect, it } from "vitest";
import { fitCircle, type Camera } from "./map-camera";
import { BEYOND, labelPlan, layoutWorld, provinceDots, WORLD, type World } from "./island-world";
import type { VocabMapRegion, VocabMapWord } from "./types";

const IDS = ["people", "body", "food", "home", "shopping", "travel", "work", "nature", "time", "mind", "leisure", "society",
  "communication", "core"];

const words = (prefix: string, n: number, band = "A1"): VocabMapWord[] =>
  Array.from({ length: n }, (_, i) => ({ term: `${prefix}${i}`, band, status: null, meaning: null }));

/** A blueprint-shaped map: each region gets areas of these sizes. */
function regions(sizes: (id: string) => number[]): VocabMapRegion[] {
  return IDS.map((id) => ({
    id,
    name: id,
    areas: sizes(id).map((n, i) => ({ id: `${id}-${i}`, name: `${id} ${i}`, words: words(`${id}${i}-`, n) })),
  }));
}

const french = regions((id) => (id === "core" ? [107, 71, 68, 36, 27, 24, 20, 9] : id === "communication" ? [29, 16, 15] : [48, 40, 35, 30]));
const world = layoutWorld(french);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("layoutWorld", () => {
  it("draws one island per region and one province per area, in the map's order", () => {
    expect(world.islands.map((i) => i.region.id)).toEqual(IDS);
    expect(world.islands[13].provinces.map((p) => p.area.id)).toEqual(french[13].areas.map((a) => a.id));
    expect(world.width).toBe(WORLD.width);
    expect(world.height).toBe(WORLD.height);
  });

  it("keeps islands apart and inside the world, with the uncharted sea clear of them", () => {
    for (const a of world.islands) {
      const { x, y, r } = a.shallows;
      expect(x - r).toBeGreaterThanOrEqual(0);
      expect(y - r).toBeGreaterThanOrEqual(0);
      expect(x + r).toBeLessThanOrEqual(WORLD.width);
      expect(y + r).toBeLessThanOrEqual(WORLD.height);
      expect(dist(a.shallows, BEYOND)).toBeGreaterThan(r + 60);
      for (const b of world.islands) {
        if (a !== b) expect(dist(a.shallows, b.shallows)).toBeGreaterThanOrEqual(a.shallows.r + b.shallows.r);
      }
    }
  });

  it("puts every island in the same place in every language", () => {
    const other = layoutWorld(regions((id) => (id === "food" ? [200, 10] : [12, 12, 12])));
    const places = (w: World) => w.islands.map((i) => [i.shallows.x, i.shallows.y]);
    expect(places(other)).toEqual(places(world));
    other.islands.forEach((i, n) => {
      expect(i.circle.x).toBeCloseTo(world.islands[n].circle.x, 6);
      expect(i.circle.y).toBeCloseTo(world.islands[n].circle.y, 6);
    });
  });

  it("makes bigger regions bigger islands", () => {
    const byId = (id: string) => world.islands.find((i) => i.region.id === id)!.circle.r;
    expect(byId("core")).toBeGreaterThan(byId("food"));
    expect(byId("food")).toBeGreaterThan(byId("communication"));
  });

  it("keeps provinces apart, inside their island, sized by their words", () => {
    for (const island of world.islands) {
      for (const p of island.provinces) {
        expect(dist(p.circle, island.circle) + p.circle.r).toBeLessThanOrEqual(island.circle.r + 1e-6);
        for (const q of island.provinces) {
          if (p !== q) expect(dist(p.circle, q.circle)).toBeGreaterThan(p.circle.r + q.circle.r);
        }
      }
    }
    const [big, , , small] = world.islands[0].provinces;
    expect(big.circle.r).toBeGreaterThan(small.circle.r);
    expect(big.land).toMatch(/^M.*Z$/);
    expect(world.islands[0].coast).toHaveLength(4);
  });

  it("finds a place for a region the layout doesn't know, and gives an empty area a small province", () => {
    const extra = layoutWorld([...french, { id: "space", name: "Space", areas: [{ id: "stars", name: "Stars", words: [] }] }]);
    const island = extra.islands[14];
    expect(island.circle.x).toBeGreaterThan(0);
    expect(island.provinces[0].circle.r).toBeGreaterThan(0);
    for (const other of extra.islands.slice(0, 14)) {
      expect(dist(island.shallows, other.shallows)).toBeGreaterThanOrEqual(island.shallows.r + other.shallows.r);
    }
  });
});

describe("provinceDots", () => {
  const province = world.islands[2].provinces[0];
  const shown = words("w", 30).map((word) => ({ word, faint: false }));
  const next = words("n", 10, "A2").map((word) => ({ word, faint: true }));
  const { dots, spacing } = provinceDots(province, [...shown, ...next]);

  it("puts a dot for every word inside the province, the counted words nearest the middle", () => {
    expect(dots).toHaveLength(40);
    for (const d of dots) expect(dist(d, province.circle)).toBeLessThan(province.circle.r * 0.9);
    expect(dots[0].word.term).toBe("w0");
    expect(dots[39].faint).toBe(true);
    expect(dist(dots[0], province.circle)).toBeLessThan(dist(dots[39], province.circle));
  });

  it("spaces the dots evenly, closer the more words there are", () => {
    for (let i = 0; i < dots.length; i++) {
      for (let j = i + 1; j < dots.length; j++) expect(dist(dots[i], dots[j])).toBeGreaterThan(spacing * 0.5);
    }
    expect(provinceDots(province, shown).spacing).toBeGreaterThan(spacing);
    expect(provinceDots(province, []).dots).toEqual([]);
  });
});

describe("labelPlan", () => {
  const viewport = { width: 800, height: 500 };
  const spacingOf = (w: World) => (areaId: string) => {
    const p = w.islands.flatMap((i) => i.provinces).find((q) => q.area.id === areaId)!;
    return provinceDots(p, p.area.words.map((word) => ({ word, faint: false }))).spacing;
  };
  const plan = (cam: Camera) => labelPlan(world, cam, viewport, spacingOf(world));

  it("names every island when zoomed out", () => {
    const out = plan({ x: WORLD.width / 2, y: WORLD.height / 2, k: Math.min(800 / WORLD.width, 500 / WORLD.height) });
    expect(out.islands.size).toBe(14);
    expect(out.provinces.size).toBe(0);
    expect(out.words.size).toBe(0);
  });

  it("names an island's provinces instead of the island once it fills the map", () => {
    const food = world.islands[2];
    const out = plan(fitCircle(food.circle, viewport, 0.06));
    expect(out.islands.has("food")).toBe(false);
    expect([...out.provinces].filter((id) => id.startsWith("food-"))).toHaveLength(4);
    expect(out.words.size).toBe(0);
  });

  it("writes each word beside its dot once a province fills the map, and skips what is off screen", () => {
    const province = world.islands[2].provinces[0];
    const out = plan(fitCircle(province.circle, viewport, 0.06));
    expect(out.words.has(province.area.id)).toBe(true);
    expect(out.provinces.has(province.area.id)).toBe(false);
    expect(out.islands.has("people")).toBe(false);
    expect(out.provinces.has("people-0")).toBe(false);
  });
});
