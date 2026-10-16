import { describe, expect, it } from "vitest";
import { pieceCount } from "./hex-grid";
import { layoutHexWorld } from "./hex-world";
import type { VocabMapRegion } from "./types";

const FRENCH_TO_C1: [string, number[]][] = [
  ["people", [100, 97, 95, 91]], ["body", [118, 125, 103, 98]], ["food", [121, 127, 106, 80, 66, 88]],
  ["home", [144, 92, 91, 114]], ["shopping", [143, 129, 95, 102]], ["travel", [163, 106, 66, 114]],
  ["work", [135, 102, 115, 90]], ["nature", [112, 196, 135, 124, 101]], ["time", [105, 94, 81, 70, 101]],
  ["mind", [178, 123, 137, 173]], ["leisure", [111, 150, 151, 122, 94]], ["society", [149, 137, 94, 76, 87]],
  ["communication", [131, 84, 87]], ["core", [32, 23, 50, 28, 9, 696, 466, 161]],
];

const regions: VocabMapRegion[] = FRENCH_TO_C1.map(([id, areas]) => ({
  id,
  name: id,
  areas: areas.map((n, i) => ({
    id: `${id}-${i}`,
    name: `${id} ${i}`,
    words: Array.from({ length: n }, (_, j) => ({ term: `${id}${i}w${j}`, band: "A1", status: null, meaning: null })),
  })),
}));

describe("the French map up to C1", () => {
  it.each([false, true])("keeps every province in one piece, small ones beside big ones too (portrait %s)", (portrait) => {
    const world = layoutHexWorld(regions, portrait);
    const broken = world.countries.flatMap((c) => c.areas).filter((a) => pieceCount(a.hexes) !== 1).map((a) => a.areaId);
    expect(broken).toEqual([]);
  });
});
