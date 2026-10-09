import { describe, expect, it } from "vitest";
import { hexPath } from "./hex-grid";
import { fitTags, groundOf, tileKind, tileLayers, wordFontSize } from "./hex-view";
import { layoutHexWorld, TILE } from "./hex-world";
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
  const spot = (id: string, x: number, y: number, weight: number, name = id) => ({ id, x, y, weight, name });

  it("shows every tag in full when they are apart", () => {
    const shown = fitTags([spot("a", 0, 0, 10), spot("b", 300, 0, 5)]);
    expect([...shown.values()]).toEqual(["full", "full"]);
  });

  it("drops the smaller country's count first, then its whole tag, when tags would overlap", () => {
    // Close enough that both counts can't fit, but the smaller one's name alone fits above the bigger tag.
    const near = fitTags([spot("big", 0, 0, 100, "Core words"), spot("small", 0, -34, 10, "Society & News")]);
    expect(near.get("big")).toBe("full");
    expect(near.get("small")).toBe("name");
    const on = fitTags([spot("big", 0, 0, 100, "Core words"), spot("small", 4, 2, 10, "Communication")]);
    expect(on.get("small")).toBe("hidden");
  });

  it("splits names after \"&\" onto two lines, so a long name takes less room across", () => {
    const sideBySide = (name: string) => fitTags([spot("big", 0, 0, 100, "Core words"), spot("small", 110, 0, 10, name)]).get("small");
    expect(sideBySide("Food & Drink")).toBe("full");
    expect(sideBySide("Communication and everything")).toBe("hidden");
  });
});

describe("wordFontSize", () => {
  it("writes short words at a fixed size and shrinks long ones to fit the tile", () => {
    expect(wordFontSize("eau")).toBe(wordFontSize("pomme"));
    expect(wordFontSize("pamplemousse")).toBeLessThan(wordFontSize("pomme"));
    expect(wordFontSize("pamplemousse") * "pamplemousse".length * 0.55).toBeLessThanOrEqual(TILE * 1.7 * 0.95 + 1e-9);
  });
});
