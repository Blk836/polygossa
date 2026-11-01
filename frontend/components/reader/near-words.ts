export const NEAR_PX = 60;

export interface WordBox {
  index: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function distance(x: number, y: number, b: WordBox): number {
  const dx = Math.max(b.left - x, 0, x - b.right);
  const dy = Math.max(b.top - y, 0, y - b.bottom);
  return Math.hypot(dx, dy);
}

export function nearWords(x: number, y: number, boxes: WordBox[], reach = NEAR_PX): number[] {
  return boxes
    .map((b) => ({ index: b.index, d: distance(x, y, b) }))
    .filter((w) => w.d <= reach)
    .sort((a, b) => a.d - b.d)
    .map((w) => w.index);
}
