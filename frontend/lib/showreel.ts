export interface Scene {
  id: string;
  caption: string;
  ms: number;
}

export const SCENES: Scene[] = [
  { id: "watch", caption: "Watch something you love", ms: 5000 },
  { id: "tap", caption: "Tap the words you don't know", ms: 5500 },
  { id: "review", caption: "Review in seconds", ms: 5000 },
  { id: "again", caption: "Meet them again", ms: 4500 },
  { id: "payoff", caption: "Understand more every week", ms: 7000 },
];

const total = (scenes: Scene[]) => scenes.reduce((sum, s) => sum + s.ms, 0);

export const SHOWREEL_MS = total(SCENES);

const MAX_STEP_MS = 250;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function frameAt(elapsed: number, scenes: Scene[] = SCENES): { scene: number; progress: number } {
  const length = total(scenes);
  let t = ((elapsed % length) + length) % length;
  let scene = 0;
  while (t >= scenes[scene].ms) {
    t -= scenes[scene].ms;
    scene++;
  }
  return { scene, progress: t / scenes[scene].ms };
}

export function sceneStart(index: number, scenes: Scene[] = SCENES): number {
  return total(scenes.slice(0, index));
}

export function advance(elapsed: number, step: number, scenes: Scene[] = SCENES): number {
  const capped = Math.min(MAX_STEP_MS, Math.max(0, step));
  return (elapsed + capped) % total(scenes);
}

export function phase(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / (end - start));
}

export function countUp(from: number, to: number, progress: number): number {
  const t = clamp01(progress);
  const eased = 1 - (1 - t) ** 3;
  return Math.round(from + (to - from) * eased);
}

export function knownPercent(total: number, fresh: number): number {
  return total ? Math.round(((total - fresh) * 100) / total) : 0;
}

export function spokenIndex(progress: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}
