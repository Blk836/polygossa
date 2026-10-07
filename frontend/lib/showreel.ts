// The landing page showreel's timeline (components/landing/showreel.tsx): which scene plays at a given moment, how
// far into it we are, and the small easing helpers the scenes draw from. Time is one number, the milliseconds since
// the loop began; the component only advances it while the showreel is visible and not paused.

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

/** The longest step one frame may take: a tab that slept for a minute resumes where it was, not scenes later. */
const MAX_STEP_MS = 250;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** The scene playing `elapsed` ms into the loop, and how far through it (0 at its start, below 1 at its end). */
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

/** When scene `index` begins: jumping to a scene sets the time to this. */
export function sceneStart(index: number, scenes: Scene[] = SCENES): number {
  return total(scenes.slice(0, index));
}

/** The time after one animation frame of `step` ms, wrapping round the loop. */
export function advance(elapsed: number, step: number, scenes: Scene[] = SCENES): number {
  const capped = Math.min(MAX_STEP_MS, Math.max(0, step));
  return (elapsed + capped) % total(scenes);
}

/** Progress through a window [start, end] of a scene: 0 before it, 1 after it, linear inside. */
export function phase(progress: number, start: number, end: number): number {
  return clamp01((progress - start) / (end - start));
}

/** A counter easing (fast, then settling) from `from` to `to` as progress runs from 0 to 1; always a whole number. */
export function countUp(from: number, to: number, progress: number): number {
  const t = clamp01(progress);
  const eased = 1 - (1 - t) ** 3;
  return Math.round(from + (to - from) * eased);
}

/** Which of `count` subtitle words is being spoken: evenly paced, stopping on the last. */
export function spokenIndex(progress: number, count: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}
