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

const CHAIN = 3;
const byKey = (b: Board) => (x: number, y: number) => (hexKey(b.hexes[x]) < hexKey(b.hexes[y]) ? -1 : 1);

function spareTile(b: Board, giver: number, touches: (i: number) => boolean): number {
  const candidates = b.owner.map((_, i) => i).filter((i) => b.owner[i] === giver && b.next[i].some(touches));
  return candidates.sort(byKey(b)).find((c) => pieces(b, giver, c).length === 1) ?? -1;
}

function neighboursOf(b: Board, t: number): number[] {
  const out = new Set<number>();
  b.owner.forEach((o, i) => o === t && b.next[i].forEach((n) => b.owner[n] !== t && out.add(b.owner[n])));
  return [...out].sort((x, y) => x - y);
}

function passOn(b: Board, from: number, t: number, main: Set<number>, path: number[]): boolean {
  const targets = neighboursOf(b, from).filter((y) => !path.includes(y) || y === t).sort((x, y) => Number(y === t) - Number(x === t));
  for (const y of targets) {
    if (y !== t && path.length >= CHAIN) continue;
    const spare = spareTile(b, from, (n) => (y === t ? main.has(n) : b.owner[n] === y));
    if (spare < 0) continue;
    b.owner[spare] = y;
    if (y === t || passOn(b, y, t, main, [...path, y])) return true;
    b.owner[spare] = from;
  }
  return false;
}

function swapOne(b: Board, t: number): boolean {
  const [main, ...strays] = pieces(b, t);
  const mainSet = new Set(main);
  for (const f of strays[strays.length - 1]) {
    for (const giver of new Set(b.next[f].map((n) => b.owner[n]).filter((o) => o !== t))) {
      b.owner[f] = giver;
      if (passOn(b, giver, t, mainSet, [t, giver])) return true;
      b.owner[f] = t;
    }
  }
  return false;
}

export function mendTerritories(territories: Map<string, Hex[]>): Map<string, Hex[]> {
  const b = board(territories);
  const count = territories.size;
  const stuck = new Set<number>();
  for (let round = 0; round < 2000; round++) {
    let broken = -1;
    for (let t = 0; t < count && broken < 0; t++) if (!stuck.has(t) && pieces(b, t).length > 1) broken = t;
    if (broken < 0) break;
    if (swapOne(b, broken)) stuck.clear();
    else stuck.add(broken);
  }
  const original = [...territories.values()].flatMap((list, t) => list.map(() => t));
  return new Map([...territories.keys()].map((id, t) => {
    const kept = b.hexes.filter((_, i) => original[i] === t && b.owner[i] === t);
    const added = b.hexes.filter((_, i) => original[i] !== t && b.owner[i] === t).sort((x, y) => (hexKey(x) < hexKey(y) ? -1 : 1));
    return [id, [...kept, ...added]];
  }));
}
