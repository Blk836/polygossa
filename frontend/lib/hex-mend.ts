import { hexKey, NEIGHBOURS, type Hex } from "./hex-grid";

interface Board {
  hexes: Hex[];
  next: number[][];
  owner: number[];
}

function board(territories: Map<string, Hex[]>): Board {
  const hexes = [...territories.values()].flat();
  const index = new Map(hexes.map((h, i) => [hexKey(h), i]));
  const next = hexes.map((h) => NEIGHBOURS.map(([dq, dr]) => index.get(hexKey({ q: h.q + dq, r: h.r + dr }))).filter((n): n is number => n !== undefined));
  const owner = [...territories.values()].flatMap((list, t) => list.map(() => t));
  return { hexes, next, owner };
}

function pieces(b: Board, t: number, without = -1, add = -1): number[][] {
  const inside = (i: number) => i !== without && (b.owner[i] === t || i === add);
  const seen = new Uint8Array(b.hexes.length);
  const out: number[][] = [];
  for (let s = 0; s < b.hexes.length; s++) {
    if (seen[s] || !inside(s)) continue;
    const piece = [s];
    seen[s] = 1;
    for (let i = 0; i < piece.length; i++) {
      for (const n of b.next[piece[i]]) {
        if (!seen[n] && inside(n)) {
          piece.push(n);
          seen[n] = 1;
        }
      }
    }
    out.push(piece);
  }
  return out.sort((x, y) => y.length - x.length);
}

function spareTile(b: Board, giver: number, f: number, main: Set<number>): number {
  const candidates = b.owner.map((t, i) => i).filter((i) => b.owner[i] === giver && b.next[i].some((n) => main.has(n)));
  candidates.sort((x, y) => (hexKey(b.hexes[x]) < hexKey(b.hexes[y]) ? -1 : 1));
  return candidates.find((c) => pieces(b, giver, c, f).length === 1) ?? -1;
}

function swapOne(b: Board, t: number): boolean {
  const [main, ...strays] = pieces(b, t);
  const mainSet = new Set(main);
  for (const f of strays[strays.length - 1]) {
    for (const n of b.next[f]) {
      const giver = b.owner[n];
      if (giver === t) continue;
      const spare = spareTile(b, giver, f, mainSet);
      if (spare < 0) continue;
      b.owner[f] = giver;
      b.owner[spare] = t;
      return true;
    }
  }
  return false;
}

export function mendTerritories(territories: Map<string, Hex[]>): Map<string, Hex[]> {
  const b = board(territories);
  const count = territories.size;
  for (let round = 0; round < 2000; round++) {
    let broken = -1;
    for (let t = 0; t < count && broken < 0; t++) if (pieces(b, t).length > 1) broken = t;
    if (broken < 0 || !swapOne(b, broken)) break;
  }
  const original = [...territories.values()].flatMap((list, t) => list.map(() => t));
  return new Map([...territories.keys()].map((id, t) => {
    const kept = b.hexes.filter((_, i) => original[i] === t && b.owner[i] === t);
    const added = b.hexes.filter((_, i) => original[i] !== t && b.owner[i] === t).sort((x, y) => (hexKey(x) < hexKey(y) ? -1 : 1));
    return [id, [...kept, ...added]];
  }));
}
