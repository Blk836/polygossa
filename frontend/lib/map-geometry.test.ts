import { describe, expect, it } from "vitest";
import { blobPath, enclose, hashSeed, packCircles, seededRandom, sunflower, type Circle } from "./map-geometry";

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

describe("seeded randomness", () => {
  it("gives the same numbers for the same seed, and different ones for another", () => {
    const a = seededRandom(hashSeed("food"));
    const b = seededRandom(hashSeed("food"));
    const c = seededRandom(hashSeed("home"));
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect([c(), c(), c()]).not.toEqual(first);
  });

  it("stays between 0 and 1", () => {
    const r = seededRandom(hashSeed("x"));
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("hashes strings to distinct unsigned seeds", () => {
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
    expect(hashSeed("")).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashSeed("food & drink"))).toBe(true);
  });
});

describe("packCircles", () => {
  const radii = [10, 7, 7, 5, 4, 3];
  const packed = packCircles(radii);

  it("keeps each radius, in the given order", () => {
    expect(packed.map((c) => c.r)).toEqual(radii);
  });

  it("never overlaps two circles", () => {
    for (let i = 0; i < packed.length; i++) {
      for (let j = i + 1; j < packed.length; j++) {
        expect(dist(packed[i], packed[j])).toBeGreaterThanOrEqual(packed[i].r + packed[j].r - 1e-6);
      }
    }
  });

  it("packs them tightly around the origin, every circle touching another", () => {
    const outer = enclose(packed);
    expect(Math.hypot(outer.x, outer.y)).toBeLessThan(1e-6);
    const area = radii.reduce((s, r) => s + r * r, 0);
    expect(outer.r * outer.r).toBeLessThan(area * 2.2);
    for (let i = 0; i < packed.length; i++) {
      const touching = packed.some((o, j) => j !== i && Math.abs(dist(packed[i], o) - packed[i].r - o.r) < 1e-6);
      expect(touching).toBe(true);
    }
  });

  it("handles none, one and two circles", () => {
    expect(packCircles([])).toEqual([]);
    expect(packCircles([4])).toEqual([{ x: 0, y: 0, r: 4 }]);
    const two = packCircles([3, 1]);
    expect(dist(two[0], two[1])).toBeCloseTo(4);
    expect(enclose(two)).toEqual({ x: 0, y: 0, r: 4 });
  });
});

describe("enclose", () => {
  it("is the smallest box-centred circle around every circle", () => {
    const circles: Circle[] = [{ x: 10, y: 0, r: 2 }, { x: 20, y: 0, r: 2 }];
    expect(enclose(circles)).toEqual({ x: 15, y: 0, r: 7 });
    expect(enclose([])).toEqual({ x: 0, y: 0, r: 0 });
  });
});

describe("sunflower", () => {
  it("places n points inside the circle, the first ones nearest the middle", () => {
    const points = sunflower(50, { x: 100, y: 50, r: 20 }, 0);
    expect(points).toHaveLength(50);
    for (const p of points) expect(dist(p, { x: 100, y: 50 })).toBeLessThanOrEqual(20);
    expect(dist(points[0], { x: 100, y: 50 })).toBeLessThan(dist(points[49], { x: 100, y: 50 }));
    expect(dist(points[49], { x: 100, y: 50 })).toBeGreaterThan(18);
  });

  it("spreads them evenly: no two closer than about half the expected spacing", () => {
    const points = sunflower(200, { x: 0, y: 0, r: 100 }, 0.3);
    const spacing = 100 * Math.sqrt(Math.PI / 200);
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) expect(dist(points[i], points[j])).toBeGreaterThan(spacing * 0.5);
    }
  });

  it("gives nothing for no points", () => {
    expect(sunflower(0, { x: 0, y: 0, r: 5 }, 0)).toEqual([]);
  });
});

describe("blobPath", () => {
  it("is a closed curve that wobbles around the circle, the same for the same seed", () => {
    const path = blobPath({ x: 50, y: 50, r: 10 }, 0.1, hashSeed("fruit-veg"));
    expect(path).toMatch(/^M[\d.\- ]+( C[\d.\- ,]+)+Z$/);
    expect(blobPath({ x: 50, y: 50, r: 10 }, 0.1, hashSeed("fruit-veg"))).toBe(path);
    expect(blobPath({ x: 50, y: 50, r: 10 }, 0.1, hashSeed("drinks"))).not.toBe(path);
    const numbers = path.match(/-?[\d.]+/g)!.map(Number);
    for (let i = 0; i < numbers.length; i += 2) {
      const d = Math.hypot(numbers[i] - 50, numbers[i + 1] - 50);
      expect(d).toBeGreaterThan(10 * 0.85);
      expect(d).toBeLessThan(10 * 1.2);
    }
  });

  it("starts at its first point and has one curve per point", () => {
    const path = blobPath({ x: 0, y: 0, r: 10 }, 0, 1, 8);
    expect(path.startsWith("M10 0 C")).toBe(true);
    expect(path.match(/C/g)).toHaveLength(8);
  });
});
