import { describe, expect, it } from "vitest";
import { hexCentre, hexKey, NEIGHBOURS, nearestHex, type Hex } from "./hex-grid";
import { labelPlan, placeBox, zoomLimits } from "./hex-view";
import { areaTiles, layoutHexWorld, PLACE_MARGIN, TILE, type HexWorld } from "./hex-world";
import { fitBox } from "./map-camera";
import type { VocabMapRegion, VocabMapWord } from "./types";

const FRENCH: [string, number[]][] = [
  ["people", [42, 39, 35, 32]], ["body", [44, 34, 36, 34]], ["food", [48, 51, 38, 26, 30, 34]], ["home", [57, 26, 27, 28]],
  ["shopping", [52, 35, 36, 35]], ["travel", [59, 42, 23, 43]], ["work", [51, 33, 51, 28]], ["nature", [36, 48, 28, 33, 27]],
  ["time", [45, 50, 27, 16, 27]], ["mind", [43, 31, 32, 34]], ["leisure", [28, 43, 33, 32, 23]],
  ["society", [19, 20, 12, 11, 12]], ["communication", [29, 15, 16]], ["core", [107, 71, 68, 36, 27, 24, 20, 9]],
];
const BANDS = ["A1", "A2", "B1"];

const word = (term: string, band: string, status: VocabMapWord["status"] = null): VocabMapWord => ({ term, band, status, meaning: null });

function regions(sizes: [string, number[]][]): VocabMapRegion[] {
  return sizes.map(([id, areas]) => ({
    id,
    name: id,
    areas: areas.map((n, i) => ({
      id: `${id}-${i}`,
      name: `${id} ${i}`,
      words: Array.from({ length: n }, (_, j) => word(`${id}${i}w${j}`, BANDS[Math.min(2, Math.floor((j * 3) / n))])),
    })),
  }));
}

const french = regions(FRENCH);
const world = layoutHexWorld(french, false);
const allHexes = (w: HexWorld) => w.countries.flatMap((c) => c.areas.flatMap((a) => a.hexes));

function connected(hexes: Hex[]): boolean {
  const all = new Set(hexes.map(hexKey));
  const seen = new Set([hexKey(hexes[0])]);
  const todo = [hexes[0]];
  while (todo.length) {
    const h = todo.pop()!;
    for (const [dq, dr] of NEIGHBOURS) {
      const k = hexKey({ q: h.q + dq, r: h.r + dr });
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        todo.push({ q: h.q + dq, r: h.r + dr });
      }
    }
  }
  return seen.size === all.size;
}

function lakes(w: HexWorld): number {
  const land = new Set(allHexes(w).map(hexKey));
  const qs = allHexes(w).map((h) => h.q);
  const rs = allHexes(w).map((h) => h.r);
  const [q0, q1, r0, r1] = [Math.min(...qs) - 2, Math.max(...qs) + 2, Math.min(...rs) - 2, Math.max(...rs) + 2];
  const inside = (h: Hex) => h.q >= q0 && h.q <= q1 && h.r >= r0 && h.r <= r1;
  const sea = new Set([hexKey({ q: q0, r: r0 })]);
  const todo: Hex[] = [{ q: q0, r: r0 }];
  while (todo.length) {
    const h = todo.pop()!;
    for (const [dq, dr] of NEIGHBOURS) {
      const n = { q: h.q + dq, r: h.r + dr };
      if (inside(n) && !land.has(hexKey(n)) && !sea.has(hexKey(n))) {
        sea.add(hexKey(n));
        todo.push(n);
      }
    }
  }
  let count = 0;
  for (let q = q0; q <= q1; q++) for (let r = r0; r <= r1; r++) if (!land.has(hexKey({ q, r })) && !sea.has(hexKey({ q, r }))) count++;
  return count;
}

describe("layoutHexWorld", () => {
  it("gives every word exactly one tile, and no tile to two words", () => {
    world.countries.forEach((c, i) => c.areas.forEach((a, j) => expect(a.hexes).toHaveLength(FRENCH[i][1][j])));
    const keys = allHexes(world).map(hexKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("makes each country and each province one connected piece", () => {
    for (const c of world.countries) {
      expect(connected(c.areas.flatMap((a) => a.hexes)), c.regionId).toBe(true);
      for (const a of c.areas) expect(connected(a.hexes), a.areaId).toBe(true);
    }
  });

  it("grows the countries into one continent", () => {
    expect(connected(allHexes(world))).toBe(true);
  });

  it("leaves no sea inside the continent", () => {
    expect(lakes(world)).toBe(0);
  });


  it("grows each country from the same place in every language", () => {
    const other = layoutHexWorld(regions(FRENCH.map(([id, a]) => [id, a.map((n) => Math.max(5, Math.round(n * 0.6)))])), false);
    for (const w of [world, other]) {
      for (const c of w.countries) {
        const keys = new Set(c.areas.flatMap((a) => a.hexes).map(hexKey));
        expect(keys.has(hexKey(c.seed)), c.regionId).toBe(true);
      }
    }
    expect(other.countries.map((c) => c.seed)).toEqual(world.countries.map((c) => c.seed));
  });

  it("puts each province's tiles in order from its middle outwards", () => {
    for (const a of world.countries[2].areas) {
      const d = (i: number) => Math.hypot(a.slots[i].x - a.centre.x, a.slots[i].y - a.centre.y);
      for (let i = 1; i < a.slots.length; i++) expect(d(i)).toBeGreaterThanOrEqual(d(i - 1) - 1e-9);
    }
  });

  it("fits the continent in a world shaped like the map, with sea all round", () => {
    expect(world.width / world.height).toBeCloseTo(1.6);
    const tall = layoutHexWorld(french, true);
    expect(tall.width / tall.height).toBeCloseTo(2 / 3);
    for (const w of [world, tall]) {
      for (const a of w.countries.flatMap((c) => c.areas)) {
        for (const s of a.slots) {
          expect(s.x).toBeGreaterThan(TILE * 2);
          expect(s.y).toBeGreaterThan(TILE * 2);
          expect(s.x).toBeLessThan(w.width - TILE * 2);
          expect(s.y).toBeLessThan(w.height - TILE * 2);
        }
      }
    }
  });

  it("turns the continent on its side for a portrait map", () => {
    const tall = layoutHexWorld(french, true);
    expect(tall.countries.map((c) => c.seed)).toEqual(world.countries.map((c) => c.seed));
    const [a, b] = [world.countries[0].centre, world.countries[13].centre];
    const [ta, tb] = [tall.countries[0].centre, tall.countries[13].centre];
    expect(Math.sign(ta.y - tb.y)).toBe(Math.sign(a.x - b.x));
    expect(Math.sign(ta.x - tb.x)).toBe(Math.sign(a.y - b.y));
  });

  it("writes Beyond the core out at sea, clear of the coast", () => {
    for (const w of [world, layoutHexWorld(french, true)]) {
      const nearest = Math.min(...w.countries.flatMap((c) => c.areas.flatMap((a) => a.slots)).map((s) => Math.hypot(s.x - w.beyond.x, s.y - w.beyond.y)));
      expect(nearest).toBeGreaterThan(TILE * 4);
    }
  });

  it("draws the coast, the borders between countries and the thinner ones between provinces", () => {
    for (const d of [world.borders.coast, world.borders.countries, world.borders.areas]) expect(d).toMatch(/^M[\d.\- L]+/);
    expect(world.ground.match(/Z/g)).toHaveLength(allHexes(world).length);
  });

  it("puts each country's and province's name tag on its deepest tile, as far inside its border as it gets", () => {
    const depths = (hexes: Hex[]) => {
      const own = new Set(hexes.map(hexKey));
      const depth = new Map<string, number>();
      let ring = hexes.filter((h) => NEIGHBOURS.some(([dq, dr]) => !own.has(hexKey({ q: h.q + dq, r: h.r + dr }))));
      for (let d = 0; ring.length; d++) {
        ring.forEach((h) => depth.set(hexKey(h), d));
        ring = [...new Map(ring.flatMap((h) => NEIGHBOURS.map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr })))
          .filter((n) => own.has(hexKey(n)) && !depth.has(hexKey(n))).map((n) => [hexKey(n), n])).values()];
      }
      return depth;
    };
    const check = (hexes: Hex[], slots: { x: number; y: number }[], labelAt: { x: number; y: number }) => {
      const i = slots.findIndex((s) => s.x === labelAt.x && s.y === labelAt.y);
      expect(i).toBeGreaterThanOrEqual(0);
      const depth = depths(hexes);
      expect(depth.get(hexKey(hexes[i]))).toBe(Math.max(...depth.values()));
    };
    for (const c of world.countries) {
      check(c.areas.flatMap((a) => a.hexes), c.areas.flatMap((a) => a.slots), c.labelAt);
      for (const a of c.areas) check(a.hexes, a.slots, a.labelAt);
    }
  });

  it("offers a country's tag other places on its own land, deepest first, for when a neighbour's tag needs the room", () => {
    for (const c of world.countries) {
      const hexes = c.areas.flatMap((a) => a.hexes);
      const slots = c.areas.flatMap((a) => a.slots);
      expect(c.labelSpots[0]).toEqual(c.labelAt);
      expect(c.labelSpots.length).toBeGreaterThan(10);
      const own = new Set(hexes.map(hexKey));
      const edge = (p: { x: number; y: number }) => {
        const h = hexes[slots.findIndex((s) => s.x === p.x && s.y === p.y)];
        return NEIGHBOURS.some(([dq, dr]) => !own.has(hexKey({ q: h.q + dq, r: h.r + dr })));
      };
      const firstEdge = c.labelSpots.findIndex(edge);
      if (firstEdge >= 0) expect(c.labelSpots.slice(firstEdge).every(edge)).toBe(true);
    }
  });

  it("outlines each country and province along its own edge, for the keyboard focus ring", () => {
    const edges = (d: string) => (d.match(/M/g) ?? []).length;
    for (const c of world.countries) {
      expect(c.outline).toMatch(/^M/);
      const tiles = c.areas.reduce((s, a) => s + a.hexes.length, 0);
      expect(edges(c.outline)).toBeLessThan(tiles * 6);
      for (const a of c.areas) expect(edges(a.outline)).toBeGreaterThanOrEqual(6);
    }
    const one = layoutHexWorld([{ id: "core", name: "Core", areas: [{ id: "a", name: "A", words: [word("je", "A1")] }] }], false);
    expect(edges(one.countries[0].outline)).toBe(6);
    expect(edges(one.countries[0].areas[0].outline)).toBe(6);
  });

  it("is reused while the map's shape stays the same, whatever the words' statuses", () => {
    const again = regions(FRENCH);
    again[0].areas[0].words[0].status = "known";
    expect(layoutHexWorld(again, false)).toBe(world);
    expect(layoutHexWorld(french, true)).not.toBe(world);
  });

  it("gives a region the layout doesn't know a place too", () => {
    const extra = layoutHexWorld([...french, { id: "space", name: "Space", areas: [{ id: "stars", name: "Stars", words: [word("étoile", "A1")] }] }], false);
    expect(extra.countries[14].areas[0].hexes).toHaveLength(1);
  });
});

describe("areaTiles", () => {
  const shape = world.countries[2].areas[0];
  const words = french[2].areas[0].words;

  it("puts the counted bands in the middle, A1 first, each word in its own slot", () => {
    const tiles = areaTiles(shape, words);
    expect(tiles).toHaveLength(words.length);
    expect(tiles.slice(0, words.filter((w) => w.band === "A1").length).every((t) => t.word.band === "A1")).toBe(true);
    expect(tiles[tiles.length - 1].word.band).toBe("B1");
    expect(tiles.map((t) => [t.x, t.y])).toEqual(shape.slots.map((s) => [s.x, s.y]));
  });

  it("keeps a word's tile where it is when its status changes", () => {
    const before = areaTiles(shape, words);
    const after = areaTiles(shape, words.map((w, i) => (i === 3 ? { ...w, status: "known" as const } : w)));
    expect(after.map((t) => t.word.term)).toEqual(before.map((t) => t.word.term));
  });
});

describe("labelPlan, zoomLimits and placeBox", () => {
  const viewport = { width: 800, height: 500 };

  it("names every country when zoomed out", () => {
    const out = labelPlan(world, { x: world.width / 2, y: world.height / 2, k: zoomLimits(world, viewport).kMin }, viewport);
    expect(out.countries.size).toBe(14);
    expect(out.areas.size).toBe(0);
    expect(out.words.size).toBe(0);
  });

  it("names a country's provinces once it fills the map, and writes the words once a province does", () => {
    const food = placeBox(world, "food", null)!;
    const atCountry = labelPlan(world, fitBox(food, viewport, PLACE_MARGIN), viewport);
    expect(atCountry.countries.has("food")).toBe(false);
    expect([...atCountry.areas].filter((id) => id.startsWith("food-"))).toHaveLength(6);
    expect(atCountry.words.size).toBe(0);

    const fruit = placeBox(world, "food", "food-0")!;
    const atArea = labelPlan(world, fitBox(fruit, viewport, PLACE_MARGIN), viewport);
    expect(atArea.words.has("food-0")).toBe(true);
    expect(atArea.areas.has("food-0")).toBe(false);
  });

  it("zooms between the whole world and the smallest province", () => {
    const { kMin, kMax } = zoomLimits(world, viewport);
    expect(kMin).toBeCloseTo(Math.min(800 / world.width, 500 / world.height));
    const smallest = world.countries.flatMap((c) => c.areas).reduce((s, a) => (Math.min(a.box.w, a.box.h) < Math.min(s.box.w, s.box.h) ? a : s));
    expect(kMax).toBeCloseTo(fitBox(smallest.box, viewport, PLACE_MARGIN).k);
  });

  it("finds the box a ?map= place points at", () => {
    expect(placeBox(world, "food", "food-1")).toEqual(world.countries[2].areas[1].box);
    expect(placeBox(world, "food", "nope")).toEqual(world.countries[2].box);
    expect(placeBox(world, null, null)).toBeNull();
    expect(placeBox(world, "nope", null)).toBeNull();
  });

  it("boxes hold their tiles", () => {
    for (const c of world.countries) {
      for (const a of c.areas) {
        for (const s of a.slots) {
          expect(s.x).toBeGreaterThanOrEqual(a.box.x);
          expect(s.x).toBeLessThanOrEqual(a.box.x + a.box.w);
          expect(s.y).toBeGreaterThanOrEqual(c.box.y);
          expect(s.y).toBeLessThanOrEqual(c.box.y + c.box.h);
        }
      }
    }
    expect(nearestHex(hexCentre({ q: 0, r: 0 }, TILE, false), TILE, false)).toEqual({ q: 0, r: 0 });
  });
});

describe("layoutHexWorld for other list sizes", () => {
  it.each([0.5, 2])("leaves no sea inside the continent, and every country whole, for a list %s times the size", (scale) => {
    const w = layoutHexWorld(regions(FRENCH.map(([id, a]) => [id, a.map((n) => Math.max(3, Math.round(n * scale)))])), false);
    expect(lakes(w)).toBe(0);
    expect(connected(allHexes(w))).toBe(true);
    for (const c of w.countries) expect(connected(c.areas.flatMap((a) => a.hexes)), c.regionId).toBe(true);
  });
});
