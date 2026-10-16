import { describe, expect, it } from "vitest";
import { hexKey, NEIGHBOURS, pieceCount, type Hex } from "./hex-grid";
import { layoutHexWorld, type HexWorld } from "./hex-world";
import type { VocabMap, VocabMapRegion } from "./types";
import { bandView, drawnMap, ringScale } from "./vocab-map";

const BANDS = ["A1", "A2", "B1", "B2", "C1"];

const FRENCH_BY_BAND: [string, number[][]][] = [
  ["people", [[16, 10, 16, 19, 39], [8, 13, 18, 17, 41], [5, 10, 20, 17, 43], [1, 7, 24, 15, 44]]],
  ["body", [[14, 10, 20, 25, 49], [1, 9, 24, 30, 61], [4, 9, 23, 23, 44], [1, 12, 21, 23, 41]]],
  ["food", [[11, 12, 25, 27, 46], [12, 17, 22, 28, 48], [3, 10, 25, 27, 41], [9, 6, 11, 14, 40], [4, 9, 17, 12, 24], [7, 9, 18, 17, 37]]],
  ["home", [[11, 15, 31, 27, 60], [0, 8, 18, 24, 42], [0, 9, 18, 22, 42], [0, 2, 26, 29, 57]]],
  ["shopping", [[11, 13, 28, 35, 56], [10, 9, 16, 19, 75], [3, 11, 22, 17, 42], [6, 8, 21, 17, 50]]],
  ["travel", [[12, 14, 33, 30, 74], [8, 13, 21, 17, 47], [2, 3, 18, 13, 30], [6, 18, 19, 22, 49]]],
  ["work", [[6, 15, 30, 27, 57], [0, 10, 23, 22, 47], [12, 15, 24, 20, 44], [0, 4, 24, 22, 40]]],
  ["nature", [[9, 9, 18, 30, 46], [6, 11, 31, 41, 107], [2, 4, 22, 35, 72], [6, 8, 19, 26, 65], [0, 2, 25, 20, 54]]],
  ["time", [[24, 9, 12, 23, 37], [33, 5, 12, 17, 27], [10, 6, 11, 17, 37], [0, 4, 12, 16, 38], [0, 4, 23, 20, 54]]],
  ["mind", [[4, 9, 30, 41, 94], [5, 10, 16, 29, 63], [4, 6, 22, 31, 74], [2, 10, 22, 41, 98]]],
  ["leisure", [[6, 5, 17, 27, 56], [4, 12, 27, 36, 71], [2, 9, 22, 33, 85], [3, 7, 22, 28, 62], [4, 4, 15, 24, 47]]],
  ["society", [[0, 4, 15, 34, 96], [0, 4, 16, 31, 86], [0, 0, 12, 23, 59], [0, 2, 9, 21, 44], [1, 0, 11, 20, 55]]],
  ["communication", [[13, 5, 11, 31, 71], [4, 3, 8, 21, 48], [3, 5, 8, 17, 54]]],
  ["core", [[18, 4, 5, 3, 2], [12, 5, 3, 1, 2], [20, 5, 11, 8, 6], [10, 6, 8, 2, 2], [9, 0, 0, 0, 0], [38, 30, 39, 273, 316],
    [28, 18, 25, 87, 308], [26, 18, 24, 42, 51]]],
];

const regions: VocabMapRegion[] = FRENCH_BY_BAND.map(([id, areas]) => ({
  id,
  name: id,
  areas: areas.map((perBand, i) => ({
    id: `${id}-${i}`,
    name: `${id} ${i}`,
    words: perBand.flatMap((n, b) => Array.from({ length: n }, (_, j) => ({ term: `${id}${i}${BANDS[b]}w${j}`, band: BANDS[b], status: null, meaning: null }))),
  })),
}));

const french: VocabMap = { language: "fr", available: true, readingLevel: null, bands: BANDS, meaningLanguage: "en", beyondCore: 0, regions };
const islandAt = (top: string, portrait = false) => {
  const view = bandView(top, BANDS);
  return layoutHexWorld(drawnMap(french, view).regions, portrait, ringScale(view));
};
const allHexes = (w: HexWorld) => w.countries.flatMap((c) => c.areas.flatMap((a) => a.hexes));

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
  return (q1 - q0 + 1) * (r1 - r0 + 1) - land.size - sea.size;
}

function bearings(w: HexWorld): Map<string, number> {
  const core = w.countries.find((c) => c.regionId === "core")!.centre;
  return new Map(w.countries.filter((c) => c.regionId !== "core").map((c) => [c.regionId, Math.atan2(c.centre.y - core.y, c.centre.x - core.x)]));
}

const turn = (a: number, b: number) => Math.abs(((a - b + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);

describe("the French island at each level", () => {
  const worlds = BANDS.map((top) => islandAt(top));

  it("has a tile for each word up to the level, none for the next band's, so it grows with the level", () => {
    const upTo = (b: number) => FRENCH_BY_BAND.flatMap(([, areas]) => areas.flatMap((perBand) => perBand.slice(0, b + 1))).reduce((s, n) => s + n, 0);
    expect(worlds.map((w) => allHexes(w).length)).toEqual([upTo(0), upTo(1), upTo(2), upTo(3), upTo(4)]);
  });

  it("keeps every level's island, both ways up, so going back to a level shows it straight away", () => {
    const every = [false, true].flatMap((portrait) => BANDS.map((top) => ({ top, portrait, world: islandAt(top, portrait) })));
    for (const { top, portrait, world } of every) expect(islandAt(top, portrait), `${top} ${portrait}`).toBe(world);
  });

  it("leaves off a province with no words up to the level, even when it has the next band's", () => {
    const areasOf = (w: HexWorld, id: string) => w.countries.find((c) => c.regionId === id)!.areas.map((a) => a.areaId);
    expect(areasOf(worlds[0], "home")).toEqual(["home-0"]);
    expect(areasOf(worlds[1], "home")).toEqual(["home-0", "home-1", "home-2", "home-3"]);
    expect(areasOf(worlds[0], "society")).toEqual(["society-4"]);
    expect(areasOf(worlds[1], "society")).toEqual(["society-0", "society-1", "society-3", "society-4"]);
    expect(areasOf(worlds[2], "society")).toHaveLength(5);
  });

  it.each(BANDS)("is one landmass with no lakes, every country and province in one piece, up to %s", (top) => {
    for (const portrait of [false, true]) {
      const w = islandAt(top, portrait);
      expect(pieceCount(allHexes(w))).toBe(1);
      expect(lakes(w)).toBe(0);
      expect(w.countries.filter((c) => pieceCount(c.areas.flatMap((a) => a.hexes)) !== 1).map((c) => c.regionId)).toEqual([]);
      expect(w.countries.flatMap((c) => c.areas).filter((a) => pieceCount(a.hexes) !== 1).map((a) => a.areaId)).toEqual([]);
    }
  });

  it("keeps Core in the middle and every other country on the same side of it, in the same order around it", () => {
    const top = bearings(worlds[4]);
    const order = (b: Map<string, number>) => [...b.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
    const rotated = (ids: string[]) => [...ids.slice(ids.indexOf("people")), ...ids.slice(0, ids.indexOf("people"))];
    for (const w of worlds) {
      const b = bearings(w);
      expect(rotated(order(b))).toEqual(rotated(order(top)));
      for (const [id, angle] of b) expect(turn(angle, top.get(id)!), id).toBeLessThan(Math.PI / 6);
    }
  });
});
