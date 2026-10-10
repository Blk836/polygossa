import { describe, expect, it } from "vitest";
import { clampCamera, easeInOut, fitBox, panBy, toTransform, tween, visibleRect, zoomAt, type Camera, type Limits } from "./map-camera";

const viewport = { width: 800, height: 500 };
const world = { width: 1600, height: 1000 };
const limits: Limits = { kMin: 0.5, kMax: 8 };

describe("fitBox", () => {
  it("centres the box and fits its tighter side, with a margin", () => {
    const wide = fitBox({ x: 100, y: 50, w: 400, h: 100 }, viewport, 0.1);
    expect([wide.x, wide.y]).toEqual([300, 100]);
    expect(wide.k).toBeCloseTo(800 / (400 * 1.1));
    const tall = fitBox({ x: 0, y: 0, w: 100, h: 400 }, viewport, 0);
    expect(tall.k).toBeCloseTo(500 / 400);
  });
});

describe("toTransform", () => {
  it("puts the camera's centre in the middle of the viewport", () => {
    expect(toTransform({ x: 300, y: 200, k: 2 }, viewport)).toBe("translate(-200 -150) scale(2)");
  });
});

describe("clampCamera", () => {
  it("keeps the zoom between the whole world and a single province", () => {
    expect(clampCamera({ x: 800, y: 500, k: 0.1 }, world, viewport, limits).k).toBe(0.5);
    expect(clampCamera({ x: 800, y: 500, k: 50 }, world, viewport, limits).k).toBe(8);
  });

  it("stops at the edge of the world", () => {
    const cam = clampCamera({ x: -500, y: 5000, k: 2 }, world, viewport, limits);
    expect(cam.x).toBe(200);
    expect(cam.y).toBe(1000 - 125);
  });

  it("centres the world along a side it doesn't fill", () => {
    const cam = clampCamera({ x: 100, y: 100, k: 0.5 }, world, viewport, limits);
    expect(cam).toEqual({ x: 800, y: 500, k: 0.5 });
  });

  it("leaves a camera that is already inside alone", () => {
    const cam: Camera = { x: 700, y: 600, k: 3 };
    expect(clampCamera(cam, world, viewport, limits)).toEqual(cam);
  });
});

describe("zoomAt", () => {
  it("keeps the world point under the pointer in place", () => {
    const before: Camera = { x: 800, y: 500, k: 1 };
    const pointer = { x: 600, y: 100 };
    const after = zoomAt(before, 2, pointer, viewport);
    const under = (c: Camera) => ({ x: c.x + (pointer.x - 400) / c.k, y: c.y + (pointer.y - 250) / c.k });
    expect(after.k).toBe(2);
    expect(under(after).x).toBeCloseTo(under(before).x);
    expect(under(after).y).toBeCloseTo(under(before).y);
  });
});

describe("panBy", () => {
  it("moves the world with the pointer", () => {
    expect(panBy({ x: 500, y: 500, k: 2 }, 100, -40)).toEqual({ x: 450, y: 520, k: 2 });
  });
});

describe("tween", () => {
  const from: Camera = { x: 0, y: 0, k: 1 };
  const to: Camera = { x: 100, y: 50, k: 4 };

  it("starts at one camera and ends at the other", () => {
    expect(tween(from, to, 0)).toEqual(from);
    expect(tween(from, to, 1)).toEqual(to);
  });

  it("zooms evenly: halfway is the geometric middle of the two zooms", () => {
    const mid = tween(from, to, 0.5);
    expect(mid.k).toBeCloseTo(2);
    expect(mid.x).toBeCloseTo(50);
    expect(mid.y).toBeCloseTo(25);
  });
});

describe("easeInOut", () => {
  it("starts and ends slowly", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });
});

describe("visibleRect", () => {
  it("is the part of the world the viewport shows", () => {
    expect(visibleRect({ x: 400, y: 300, k: 2 }, viewport)).toEqual({ left: 200, top: 175, right: 600, bottom: 425 });
  });
});
