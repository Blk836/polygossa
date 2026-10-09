import { describe, expect, it } from "vitest";
import { hexPath } from "./hex-grid";
import { fitTags, groundOf, placeCamera, tileKind, tileLayers, wordFontSize, zoomLimits } from "./hex-view";
import { layoutHexWorld, PLACE_MARGIN, TILE } from "./hex-world";
import { fitBox } from "./map-camera";
import type { VocabMapRegion, VocabMapWord } from "./types";
import type { BandView } from "./vocab-map";

const word = (term: string, band: string, status: VocabMapWord["status"] = null): VocabMapWord => ({ term, band, status, meaning: null });
const atA1: BandView = { shown: ["A1"], next: "A2", soon: null };

describe("tileKind", () => {
  it("colours a counted word by its status, new when it has none", () => {
    expect(tileKind(word("a", "A1", "known"), atA1)).toBe("known");
    expect(tileKind(word("a", "A1", "learning"), atA1)).toBe("learning");
    expect(tileKind(word("a", "A1", "ignored"), atA1)).toBe("ignored");
    expect(tileKind(word("a", "A1"), atA1)).toBe("new");
  });

  it("makes the next band's words pale and later bands' paler, whatever their status", () => {
    expect(tileKind(word("a", "A2", "known"), atA1)).toBe("next");
    expect(tileKind(word("a", "B1", "known"), atA1)).toBe("later");
    expect(tileKind(word("a", "B1"), { shown: ["A1", "A2", "B1"], next: null, soon: "B2" })).toBe("new");
  });
});

describe("tileLayers", () => {
  const regions: VocabMapRegion[] = [
    { id: "food", name: "Food", areas: [{ id: "fruit", name: "Fruit", words: [word("pomme", "A1", "known"), word("poire", "A1"), word("kiwi", "A2")] }] },
    { id: "core", name: "Core", areas: [{ id: "verbs", name: "Verbs", words: [word("être", "A1", "learning"), word("falloir", "B1")] }] },
  ];
  const world = layoutHexWorld(regions, false);
  const tiles = (d: string) => (d.match(/M/g) ?? []).length;

  it("puts every word's tile in exactly one layer, by its kind", () => {
    const layers = tileLayers(world, regions, atA1);
    expect(tiles(layers.known)).toBe(1);
    expect(tiles(layers.learning)).toBe(1);
    expect(tiles(layers.new)).toBe(1);
    expect(tiles(layers.next)).toBe(1);
    expect(tiles(layers.later)).toBe(1);
    expect(layers.ignored).toBe("");
  });

  it("moves a tile between layers when its word's status changes, not its place", () => {
    const before = tileLayers(world, regions, atA1);
    const changed = regions.map((r) => ({ ...r, areas: r.areas.map((a) => ({ ...a, words: a.words.map((w) => (w.term === "poire" ? { ...w, status: "known" as const } : w)) })) }));
    const after = tileLayers(world, changed, atA1);
    expect(after.new).toBe("");
    expect(after.known).toBe(before.known + before.new);
  });
});

describe("groundOf", () => {
  it("is one full-size tile outline per point", () => {
    const pts = [{ x: 0, y: 0 }, { x: 30, y: 0 }];
    expect(groundOf(pts, true)).toBe(hexPath(pts[0], TILE, true) + hexPath(pts[1], TILE, true));
  });
});

describe("fitTags", () => {
  const spot = (id: string, x: number, y: number, weight: number, name = id, count = "0 / 11", more: { x: number; y: number }[] = []) =>
    ({ id, places: [{ x, y }, ...more], weight, name, count });
  const big = spot("big", 0, 0, 100, "Core words", "4 / 161");

  it("shows every tag in full, in its best place, when they are apart", () => {
    const shown = fitTags([spot("a", 0, 0, 10), spot("b", 300, 0, 5)]);
    expect([...shown.values()]).toEqual([{ show: "full", dx: 0, dy: 0 }, { show: "full", dx: 0, dy: 0 }]);
  });

  it("moves a smaller country's tag to the first of its other places with room", () => {
    const fit = fitTags([big, spot("small", 0, -30, 10, "Home", "0 / 11", [{ x: 5, y: -32 }, { x: 0, y: -45 }, { x: 0, y: -60 }])]).get("small")!;
    expect(fit).toEqual({ show: "full", dx: 0, dy: -15 });
  });

  it("drops the smaller country's count when moving isn't enough, then its whole tag", () => {
    const between = fitTags([big, spot("top", 0, -80, 50, "Home"), spot("small", 0, -40, 10, "Society & News", "0 / 1")]);
    expect(between.get("big")!.show).toBe("full");
    expect(between.get("top")!.show).toBe("full");
    expect(between.get("small")!.show).toBe("name");
    expect(fitTags([big, spot("small", 4, 2, 10, "Communication")]).get("small")!.show).toBe("hidden");
  });

  it("places a squeezed country's tag first when that lets every tag show", () => {
    const roomy = spot("roomy", 0, 0, 50, "Society & News", "0 / 1", [{ x: 0, y: -60 }]);
    const squeezed = spot("squeezed", 0, 5, 40, "Communication", "0 / 20");
    const fits = fitTags([roomy, squeezed]);
    expect(fits.get("squeezed")!.show).not.toBe("hidden");
    expect(fits.get("roomy")).toEqual({ show: "full", dx: 0, dy: -60 });
  });

  it("splits names after \"&\" onto two lines, so a long name takes less room across", () => {
    const sideBySide = (name: string) => fitTags([big, spot("small", 80, 0, 10, name)]).get("small")!.show;
    expect(sideBySide("Food & Drink")).toBe("full");
    expect(sideBySide("Communication and everything")).toBe("hidden");
  });
});

describe("placeCamera", () => {
  const regions: VocabMapRegion[] = [{ id: "food", name: "Food", areas: [
    { id: "fruit", name: "Fruit", words: Array.from({ length: 60 }, (_, i) => word(`f${i}`, "A1")) },
    { id: "drinks", name: "Drinks", words: Array.from({ length: 20 }, (_, i) => word(`d${i}`, "A1")) },
  ] }];
  const world = layoutHexWorld(regions, true);
  const phone = { width: 358, height: 537 };
  const desk = { width: 1100, height: 690 };
  const fruit = world.countries[0].areas[0].box;

  it("shows the whole world when no place is open", () => {
    const limits = zoomLimits(world, desk);
    expect(placeCamera(world, null, null, desk)).toEqual({ x: world.width / 2, y: world.height / 2, k: limits.kMin });
  });

  it("fits a country, or a province on a big screen, to the map", () => {
    expect(placeCamera(world, "food", null, desk)).toEqual(fitBox(world.countries[0].box, desk, PLACE_MARGIN));
    const k = fitBox(fruit, desk, PLACE_MARGIN).k;
    expect(k * TILE * Math.sqrt(3)).toBeGreaterThanOrEqual(44);
    expect(placeCamera(world, "food", "fruit", desk)).toEqual(fitBox(fruit, desk, PLACE_MARGIN));
  });

  it("zooms a province in far enough on a phone that every word's tile is big enough to tap", () => {
    const cam = placeCamera(world, "food", "fruit", phone);
    expect(cam.k * TILE * Math.sqrt(3)).toBeGreaterThanOrEqual(44);
    expect(cam.k * TILE * Math.sqrt(3)).toBeLessThan(48);
    expect(cam.k).toBeGreaterThan(fitBox(fruit, phone, PLACE_MARGIN).k);
    expect({ x: cam.x, y: cam.y }).toEqual({ x: fruit.x + fruit.w / 2, y: fruit.y + fruit.h / 2 });
    expect(zoomLimits(world, phone).kMax).toBeGreaterThanOrEqual(cam.k);
  });
});

describe("wordFontSize", () => {
  it("writes short words at a fixed size and shrinks long ones to fit the tile", () => {
    expect(wordFontSize("eau")).toBe(wordFontSize("pomme"));
    expect(wordFontSize("pamplemousse")).toBeLessThan(wordFontSize("pomme"));
    expect(wordFontSize("pamplemousse") * "pamplemousse".length * 0.55).toBeLessThanOrEqual(TILE * 1.7 * 0.95 + 1e-9);
  });
});
