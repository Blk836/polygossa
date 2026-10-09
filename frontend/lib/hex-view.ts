// What the vocabulary map's hex continent shows at a zoom (vocabulary-map.feature): country names far out, province
// names in an open country, words in a close province; how far the map zooms; and where a ?map= place is. Pure and
// unit-tested (hex-world.test.ts).
import { TILE, PLACE_MARGIN, type HexWorld } from "./hex-world";
import { fitBox, visibleRect, type Box, type Camera, type Limits, type Size } from "./map-camera";

/**
 * Once a country fills this share of the view (across or down, whichever is more), it counts as open: its provinces are
 * named. A province filling this share is close: its words are written in its tiles.
 */
const COUNTRY_OPEN = 0.5;
const AREA_CLOSE = 0.8;
/** A tile must be at least this many pixels across for its word to be written in it. */
const WORD_PX = 24;

export interface LabelPlan {
  countries: Set<string>;
  areas: Set<string>;
  /** Areas whose tiles have their words written in them. */
  words: Set<string>;
}

/** What to write at this zoom: country names far out, province names in an open country, words in a close province. */
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

/** How far the map zooms: out to the whole world, in to its smallest province. */
export function zoomLimits(world: HexWorld, viewport: Size): Limits {
  const kMin = Math.min(viewport.width / world.width, viewport.height / world.height);
  const inner = world.countries.flatMap((c) => c.areas).map((a) => fitBox(a.box, viewport, PLACE_MARGIN).k);
  return { kMin, kMax: Math.max(kMin, ...inner) };
}

/** The country ("?map=food") or province ("food/fruit-veg") a place shows, or null for the whole world. */
export function placeBox(world: HexWorld, regionId: string | null, areaId: string | null): Box | null {
  const country = world.countries.find((c) => c.regionId === regionId);
  if (!country) return null;
  return country.areas.find((a) => a.areaId === areaId)?.box ?? country.box;
}
