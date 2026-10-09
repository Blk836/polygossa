// Shared basics for the vocabulary map's hex continent (vocabulary-map.feature): a point, and a seeded hash, so every
// shape grown from it is the same on every visit. Pure and unit-tested; lib/hex-grid.ts and lib/hex-world.ts use them.

export interface Point {
  x: number;
  y: number;
}

/** FNV-1a: a string (a region or area id) to a 32-bit seed. */
export function hashSeed(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
