import { describe, expect, it } from "vitest";
import { SCENES, SHOWREEL_MS, advance, countUp, frameAt, phase, sceneStart, spokenIndex, type Scene } from "./showreel";

const THREE: Scene[] = [
  { id: "a", caption: "A", ms: 1000 },
  { id: "b", caption: "B", ms: 2000 },
  { id: "c", caption: "C", ms: 500 },
];

describe("the scenes", () => {
  it("are the five steps of the story, in order", () => {
    expect(SCENES.map((s) => s.caption)).toEqual([
      "Watch something you love",
      "Tap the words you don't know",
      "Review in seconds",
      "Meet them again",
      "Understand more every week",
    ]);
  });

  it("each last long enough to read, and the whole loop is their sum", () => {
    for (const s of SCENES) expect(s.ms).toBeGreaterThanOrEqual(3000);
    expect(SHOWREEL_MS).toBe(SCENES.reduce((sum, s) => sum + s.ms, 0));
  });
});

describe("frameAt", () => {
  it.each([
    [0, 0, 0],
    [500, 0, 0.5],
    [999, 0, 0.999],
    [1000, 1, 0],
    [2000, 1, 0.5],
    [3000, 2, 0],
    [3250, 2, 0.5],
  ])("maps %i ms to scene %i at %f", (elapsed, scene, progress) => {
    const f = frameAt(elapsed, THREE);
    expect(f.scene).toBe(scene);
    expect(f.progress).toBeCloseTo(progress, 6);
  });

  it("wraps after the last scene, and for negative times", () => {
    expect(frameAt(3500, THREE)).toEqual({ scene: 0, progress: 0 });
    expect(frameAt(3500 + 2000, THREE)).toEqual({ scene: 1, progress: 0.5 });
    expect(frameAt(-250, THREE)).toEqual({ scene: 2, progress: 0.5 });
  });

  it("uses the real scenes by default", () => {
    expect(frameAt(SCENES[0].ms)).toEqual({ scene: 1, progress: 0 });
  });
});

describe("sceneStart", () => {
  it("is the time the scene begins", () => {
    expect([0, 1, 2].map((i) => sceneStart(i, THREE))).toEqual([0, 1000, 3000]);
    expect(sceneStart(1)).toBe(SCENES[0].ms);
  });

  it("jumping there plays that scene from its start", () => {
    expect(frameAt(sceneStart(2, THREE), THREE)).toEqual({ scene: 2, progress: 0 });
  });
});

describe("advance", () => {
  it("moves time forward and wraps around the loop", () => {
    expect(advance(100, 50, THREE)).toBe(150);
    expect(advance(3400, 200, THREE)).toBe(100);
    expect(advance(0, 0, THREE)).toBe(0);
    expect(advance(SHOWREEL_MS - 1, 1)).toBe(0);
  });

  it("ignores huge or negative steps (a tab that slept) by capping them", () => {
    expect(advance(100, 60_000, THREE)).toBe(100 + 250);
    expect(advance(100, -5, THREE)).toBe(100);
  });
});

describe("phase", () => {
  it("is 0 before the window, 1 after it and linear inside", () => {
    expect(phase(0.1, 0.2, 0.6)).toBe(0);
    expect(phase(0.2, 0.2, 0.6)).toBe(0);
    expect(phase(0.4, 0.2, 0.6)).toBeCloseTo(0.5, 6);
    expect(phase(0.6, 0.2, 0.6)).toBe(1);
    expect(phase(0.9, 0.2, 0.6)).toBe(1);
  });
});

describe("countUp", () => {
  it("eases from start to end without overshooting", () => {
    expect(countUp(1240, 1284, 0)).toBe(1240);
    expect(countUp(1240, 1284, 1)).toBe(1284);
    expect(countUp(1240, 1284, -1)).toBe(1240);
    expect(countUp(1240, 1284, 2)).toBe(1284);
    const mid = countUp(1240, 1284, 0.5);
    // ease-out: past halfway at half time
    expect(mid).toBeGreaterThan(1262);
    expect(mid).toBeLessThan(1284);
  });

  it("only ever climbs as time passes", () => {
    let last = -Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const v = countUp(72, 97, t);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(Number.isInteger(v)).toBe(true);
      last = v;
    }
  });
});

describe("spokenIndex", () => {
  it("walks through the words in order and ends on the last", () => {
    expect(spokenIndex(0, 4)).toBe(0);
    expect(spokenIndex(0.24, 4)).toBe(0);
    expect(spokenIndex(0.25, 4)).toBe(1);
    expect(spokenIndex(0.99, 4)).toBe(3);
    expect(spokenIndex(1, 4)).toBe(3);
    expect(spokenIndex(1.5, 4)).toBe(3);
    expect(spokenIndex(-1, 4)).toBe(0);
  });
});
