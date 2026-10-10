import { hexPath } from "./hex-grid";
import { areaTiles, TILE, PLACE_MARGIN, type HexWorld } from "./hex-world";
import { fitBox, visibleRect, type Box, type Camera, type Limits, type Size } from "./map-camera";
import type { Point } from "./map-geometry";
import type { VocabMapRegion, VocabMapWord } from "./types";
import type { BandView } from "./vocab-map";

export type TileKind = "known" | "learning" | "new" | "ignored" | "next" | "later";

export const TILE_KINDS: TileKind[] = ["known", "learning", "new", "ignored", "next", "later"];

export function tileKind(word: VocabMapWord, view: BandView): TileKind {
  if (!view.shown.includes(word.band)) return word.band === view.next ? "next" : "later";
  return word.status ?? "new";
}

const GROUT = 0.9;

export function tileLayers(world: HexWorld, regions: VocabMapRegion[], view: BandView): Record<TileKind, string> {
  const layers: Record<TileKind, string> = { known: "", learning: "", new: "", ignored: "", next: "", later: "" };
  const areas = new Map(regions.flatMap((r) => r.areas.map((a) => [a.id, a.words] as const)));
  for (const shape of world.countries.flatMap((c) => c.areas)) {
    for (const t of areaTiles(shape, areas.get(shape.areaId) ?? [])) layers[tileKind(t.word, view)] += hexPath(t, TILE, world.portrait, GROUT);
  }
  return layers;
}

export function groundOf(points: Point[], portrait: boolean): string {
  return points.map((p) => hexPath(p, TILE, portrait)).join("");
}

export interface TagSpot {
  id: string;
  name: string;
  places: Point[];
  weight: number;
  count: string;
}

export interface TagFit {
  show: "full" | "name" | "hidden";
  dx: number;
  dy: number;
}

const TAG = { letter: 5.7, line: 13, gap: 3, digit: 5.6, chip: { pad: 12, h: 16 }, margin: 1 };

interface Rect { left: number; top: number; right: number; bottom: number }

function tagRect(s: TagSpot, show: TagFit["show"], at: Point): Rect {
  const lines = s.name.split(" & ").map((l, i, all) => (i < all.length - 1 ? `${l} &` : l));
  const chip = s.count.length * TAG.digit + TAG.chip.pad;
  const w = Math.max(...lines.map((l) => l.length * TAG.letter), show === "full" ? chip : 0) + 2 * TAG.margin;
  const h = lines.length * TAG.line + (show === "full" ? TAG.gap + TAG.chip.h : 0) + 2 * TAG.margin;
  return { left: at.x - w / 2, right: at.x + w / 2, top: at.y - h / 2, bottom: at.y + h / 2 };
}

const overlaps = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

export function fitTags(spots: TagSpot[]): Map<string, TagFit> {
  const order = [...spots].sort((a, b) => b.weight - a.weight);
  const first = placeTags(order);
  const left = order.filter((s) => first.get(s.id)!.show === "hidden");
  if (left.length === 0) return first;
  const again = placeTags([...left, ...order.filter((s) => !left.includes(s))]);
  const hidden = (fits: Map<string, TagFit>) => [...fits.values()].filter((f) => f.show === "hidden").length;
  return hidden(again) < hidden(first) ? again : first;
}

function placeTags(order: TagSpot[]): Map<string, TagFit> {
  const placed: Rect[] = [];
  const out = new Map<string, TagFit>();
  for (const s of order) {
    const tries = (["full", "name"] as const).flatMap((show) => s.places.map((at) => ({ show, at, rect: tagRect(s, show, at) })));
    const fit = tries.find((t) => !placed.some((p) => overlaps(p, t.rect)));
    if (fit) placed.push(fit.rect);
    const [best] = s.places;
    out.set(s.id, fit ? { show: fit.show, dx: fit.at.x - best.x, dy: fit.at.y - best.y } : { show: "hidden", dx: 0, dy: 0 });
  }
  return out;
}

const WRITING = TILE * 1.7 * 0.95;
const LETTER = 0.55;

export function wordFontSize(term: string): number {
  return Math.min(TILE * 1.7 * 0.26, WRITING / (Math.max(term.length, 1) * LETTER));
}

const COUNTRY_OPEN = 0.5;
const AREA_CLOSE = 0.8;
const WORD_PX = 24;

export interface LabelPlan {
  countries: Set<string>;
  areas: Set<string>;
  words: Set<string>;
}

export function labelPlan(world: HexWorld, cam: Camera, viewport: Size): LabelPlan {
  const plan: LabelPlan = { countries: new Set(), areas: new Set(), words: new Set() };
  const view = visibleRect(cam, viewport);
  const seen = (b: Box) => b.x + b.w >= view.left && b.x <= view.right && b.y + b.h >= view.top && b.y <= view.bottom;
  const fills = (b: Box) => Math.max((b.w * cam.k) / viewport.width, (b.h * cam.k) / viewport.height);
  for (const c of world.countries) {
    if (!seen(c.box)) continue;
    if (fills(c.box) < COUNTRY_OPEN) {
      plan.countries.add(c.regionId);
      continue;
    }
    for (const a of c.areas) {
      if (!seen(a.box)) continue;
      const close = fills(a.box) >= AREA_CLOSE && TILE * Math.sqrt(3) * cam.k >= WORD_PX;
      (close ? plan.words : plan.areas).add(a.areaId);
    }
  }
  return plan;
}

export function zoomLimits(world: HexWorld, viewport: Size): Limits {
  const kMin = Math.min(viewport.width / world.width, viewport.height / world.height);
  const inner = world.countries.flatMap((c) => c.areas).map((a) => fitBox(a.box, viewport, PLACE_MARGIN).k);
  return { kMin, kMax: Math.max(kMin, TAP_ZOOM, ...inner) };
}

const TAP_PX = 46;
const TAP_ZOOM = TAP_PX / (TILE * Math.sqrt(3));

export function placeCamera(world: HexWorld, regionId: string | null, areaId: string | null, viewport: Size): Camera {
  const box = placeBox(world, regionId, areaId);
  if (!box) return { x: world.width / 2, y: world.height / 2, k: zoomLimits(world, viewport).kMin };
  const cam = fitBox(box, viewport, PLACE_MARGIN);
  const isArea = world.countries.some((c) => c.regionId === regionId && c.areas.some((a) => a.areaId === areaId));
  return isArea ? { ...cam, k: Math.max(cam.k, TAP_ZOOM) } : cam;
}

export function placeBox(world: HexWorld, regionId: string | null, areaId: string | null): Box | null {
  const country = world.countries.find((c) => c.regionId === regionId);
  if (!country) return null;
  return country.areas.find((a) => a.areaId === areaId)?.box ?? country.box;
}
