import { describe, expect, it } from "vitest";
import { edgeBetween, growTerritories, hexCentre, hexKey, hexPath, NEIGHBOURS, nearestHex, outlinePath, pieceCount, type Hex } from "./hex-grid";
import { mendTerritories } from "./hex-mend";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function connected(hexes: Hex[]): boolean {
  const all = new Set(hexes.map(hexKey));
  const seen = new Set([hexKey(hexes[0])]);
  const todo = [hexes[0]];
  while (todo.length) {
    const h = todo.pop()!;
    for (const [dq, dr] of NEIGHBOURS) {
      const n = { q: h.q + dq, r: h.r + dr };
      if (all.has(hexKey(n)) && !seen.has(hexKey(n))) {
        seen.add(hexKey(n));
        todo.push(n);
      }
    }
  }
  return seen.size === all.size;
}

describe("hex maths", () => {
  it("puts neighbours one tile apart, and finds the tile under a point", () => {
    for (const portrait of [false, true]) {
      const centre = hexCentre({ q: 2, r: -1 }, 10, portrait);
      for (const [dq, dr] of NEIGHBOURS) {
        expect(dist(centre, hexCentre({ q: 2 + dq, r: -1 + dr }, 10, portrait))).toBeCloseTo(10 * Math.sqrt(3));
      }
      expect(nearestHex(centre, 10, portrait)).toEqual({ q: 2, r: -1 });
      expect(nearestHex({ x: centre.x + 4, y: centre.y - 3 }, 10, portrait)).toEqual({ q: 2, r: -1 });
    }
  });

  it("lays rows out sideways for a portrait map", () => {
    expect(hexCentre({ q: 1, r: 0 }, 10, false).y).toBe(0);
    expect(hexCentre({ q: 1, r: 0 }, 10, true).x).toBe(0);
  });

  it("draws a closed six-sided tile", () => {
    const path = hexPath({ x: 0, y: 0 }, 10, false);
    expect(path.match(/L/g)).toHaveLength(5);
    expect(path.endsWith("Z")).toBe(true);
  });

  it("finds the edge two neighbouring tiles share", () => {
    for (const portrait of [false, true]) {
      const a = { q: 0, r: 0 };
      for (const [dq, dr] of NEIGHBOURS) {
        const b = { q: dq, r: dr };
        const [p, q] = edgeBetween(a, b, 10, portrait);
        const ca = hexCentre(a, 10, portrait);
        const cb = hexCentre(b, 10, portrait);
        expect(dist(p, q)).toBeCloseTo(10);
        expect(dist(p, ca)).toBeCloseTo(dist(p, cb));
        expect(dist(q, ca)).toBeCloseTo(10);
      }
    }
  });
});

describe("outlinePath", () => {
  const loops = (d: string) => d.split("Z").filter(Boolean).map((l) => l.replace(/^M/, "").split("L"));
  const ring = NEIGHBOURS.map(([q, r]) => ({ q, r }));

  it("outlines one tile as the tile itself", () => {
    for (const portrait of [false, true]) {
      const tile = loops(hexPath(hexCentre({ q: 0, r: 0 }, 10, portrait), 10, portrait))[0];
      const outline = loops(outlinePath([{ q: 0, r: 0 }], 10, portrait));
      expect(outline).toHaveLength(1);
      expect([...outline[0]].sort()).toEqual([...tile].sort());
    }
  });

  it("draws only the outside edges, so two neighbours make one ten-cornered loop", () => {
    const d = outlinePath([{ q: 0, r: 0 }, { q: 1, r: 0 }], 10, false);
    expect(loops(d)).toHaveLength(1);
    expect(loops(d)[0]).toHaveLength(10);
  });

  it("keeps a hole as its own loop, so the sea shows through it", () => {
    const d = outlinePath(ring, 10, false);
    expect(loops(d)).toHaveLength(2);
    expect(loops(d).map((l) => l.length).sort((a, b) => a - b)).toEqual([6, 18]);
  });

  it("gives an island off the coast its own loop", () => {
    expect(loops(outlinePath([{ q: 0, r: 0 }, { q: 5, r: 0 }], 10, true))).toHaveLength(2);
  });

  it("moves the outline with the map", () => {
    const moved = outlinePath([{ q: 0, r: 0 }], 10, false, (p) => ({ x: p.x + 100, y: p.y }));
    const corners = loops(moved)[0].map((c) => Number(c.split(" ")[0]));
    expect(Math.min(...corners)).toBeGreaterThan(90);
  });
});

describe("growTerritories", () => {

  it("gives every grower exactly its quota, in one piece, without overlaps", () => {
    const growers = [
      { id: "a", seed: { q: 0, r: 0 }, quota: 200 },
      { id: "b", seed: { q: 14, r: 0 }, quota: 90 },
      { id: "c", seed: { q: -6, r: 12 }, quota: 60 },
    ];
    const out = growTerritories(growers);
    const seen = new Set<string>();
    for (const g of growers) {
      const hexes = out.get(g.id)!;
      expect(hexes).toHaveLength(g.quota);
      expect(connected(hexes)).toBe(true);
      for (const h of hexes) {
        expect(seen.has(hexKey(h))).toBe(false);
        seen.add(hexKey(h));
      }
    }
  });

  it("grows round blobs from the seed outwards", () => {
    const out = growTerritories([{ id: "a", seed: { q: 0, r: 0 }, quota: 61 }]).get("a")!;
    expect(out[0]).toEqual({ q: 0, r: 0 });
    const radius = Math.max(...out.map((h) => dist(hexCentre(h, 10, false), { x: 0, y: 0 })));
    expect(radius).toBeLessThan(10 * Math.sqrt(3) * 5);
  });

  it("never takes a blocked tile, growing round it instead", () => {
    const blocked = growTerritories([{ id: "middle", seed: { q: 0, r: 0 }, quota: 37 }]).get("middle")!;
    const out = growTerritories([{ id: "a", seed: { q: 5, r: 0 }, quota: 60 }], undefined, 0, new Set(blocked.map(hexKey))).get("a")!;
    expect(out).toHaveLength(60);
    expect(out.filter((h) => blocked.some((b) => hexKey(b) === hexKey(h)))).toEqual([]);
    expect(connected(out)).toBe(true);
  });

  it("leans a pulled territory towards its pull, closing up against what is there", () => {
    const middle = growTerritories([{ id: "m", seed: { q: 0, r: 0 }, quota: 37 }]).get("m")!;
    const blocked = new Set(middle.map(hexKey));
    const touching = (hexes: Hex[]) => hexes.filter((h) => NEIGHBOURS.some(([dq, dr]) => blocked.has(hexKey({ q: h.q + dq, r: h.r + dr })))).length;
    const free = growTerritories([{ id: "a", seed: { q: 9, r: 0 }, quota: 40 }], undefined, 0, blocked).get("a")!;
    const pulled = growTerritories([{ id: "a", seed: { q: 9, r: 0 }, quota: 40, pull: { q: 0, r: 0 } }], undefined, 0, blocked).get("a")!;
    expect(touching(free)).toBe(0);
    expect(touching(pulled)).toBeGreaterThan(3);
    expect(pulled[0]).toEqual({ q: 9, r: 0 });
  });

  it("is the same every time", () => {
    const run = () => growTerritories([
      { id: "a", seed: { q: 0, r: 0 }, quota: 50 },
      { id: "b", seed: { q: 6, r: 0 }, quota: 50 },
    ]);
    expect(run()).toEqual(run());
  });

  it("shares out a fixed set of tiles exactly, even when a grower is boxed in", () => {
    const allowed: Hex[] = [];
    for (let q = 0; q < 10; q++) for (let r = 0; r < 6; r++) allowed.push({ q, r });
    const growers = [
      { id: "big", seed: { q: 0, r: 0 }, quota: 40 },
      { id: "small", seed: { q: 9, r: 5 }, quota: 12 },
      { id: "tiny", seed: { q: 5, r: 3 }, quota: 8 },
    ];
    const out = growTerritories(growers, allowed);
    const all = [...out.values()].flat().map(hexKey);
    expect(all).toHaveLength(60);
    expect(new Set(all).size).toBe(60);
    for (const g of growers) expect(out.get(g.id)).toHaveLength(g.quota);
    const inside = new Set(allowed.map(hexKey));
    expect(all.every((k) => inside.has(k))).toBe(true);
  });

  it("mends territories that came out in pieces, by swapping border tiles, keeping each one's size", () => {
    const hexes: Hex[] = [];
    for (let q = 0; q < 6; q++) for (let r = 0; r < 3; r++) hexes.push({ q, r });
    const a = hexes.filter((h) => h.q === 0 || (h.q === 5 && h.r === 1));
    const b = hexes.filter((h) => !a.includes(h));
    const mended = mendTerritories(new Map([["a", a], ["b", b]]));
    expect(mended.get("a")).toHaveLength(a.length);
    expect(mended.get("b")).toHaveLength(b.length);
    expect(connected(mended.get("a")!)).toBe(true);
    expect(connected(mended.get("b")!)).toBe(true);
    expect([...mended.values()].flat().map(hexKey).sort()).toEqual(hexes.map(hexKey).sort());
  });

  it("leaves territories that are already whole alone", () => {
    const a = [{ q: 0, r: 0 }, { q: 1, r: 0 }];
    const b = [{ q: 2, r: 0 }];
    expect(mendTerritories(new Map([["a", a], ["b", b]]))).toEqual(new Map([["a", a], ["b", b]]));
  });

  it("grows slightly different borders for another salt, the same for the same one", () => {
    const growers = [{ id: "a", seed: { q: 0, r: 0 }, quota: 40 }, { id: "b", seed: { q: 6, r: 0 }, quota: 40 }];
    expect(growTerritories(growers, undefined, 1)).toEqual(growTerritories(growers, undefined, 1));
    expect(growTerritories(growers, undefined, 1)).not.toEqual(growTerritories(growers, undefined, 2));
  });

  it("counts a territory's pieces", () => {
    expect(pieceCount([{ q: 0, r: 0 }, { q: 1, r: 0 }])).toBe(1);
    expect(pieceCount([{ q: 0, r: 0 }, { q: 3, r: 0 }])).toBe(2);
    expect(pieceCount([])).toBe(0);
  });

  it("gives a grower with no quota nothing", () => {
    expect(growTerritories([{ id: "a", seed: { q: 0, r: 0 }, quota: 0 }]).get("a")).toEqual([]);
  });
});
