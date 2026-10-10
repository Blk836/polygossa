import type { Point } from "./map-geometry";

export interface Camera {
  x: number;
  y: number;
  k: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Limits {
  kMin: number;
  kMax: number;
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function fitBox(box: Box, viewport: Size, margin: number): Camera {
  const k = Math.min(viewport.width / box.w, viewport.height / box.h) / (1 + margin);
  return { x: box.x + box.w / 2, y: box.y + box.h / 2, k };
}

export function toTransform(cam: Camera, viewport: Size): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  return `translate(${r(viewport.width / 2 - cam.x * cam.k)} ${r(viewport.height / 2 - cam.y * cam.k)}) scale(${r(cam.k * 1000) / 1000})`;
}

function clampAxis(at: number, worldSide: number, viewSide: number, k: number): number {
  const half = viewSide / (2 * k);
  if (worldSide <= 2 * half) return worldSide / 2;
  return Math.min(Math.max(at, half), worldSide - half);
}

export function clampCamera(cam: Camera, world: Size, viewport: Size, limits: Limits): Camera {
  const k = Math.min(Math.max(cam.k, limits.kMin), limits.kMax);
  return { x: clampAxis(cam.x, world.width, viewport.width, k), y: clampAxis(cam.y, world.height, viewport.height, k), k };
}

export function zoomAt(cam: Camera, factor: number, at: Point, viewport: Size): Camera {
  const k = cam.k * factor;
  const dx = at.x - viewport.width / 2;
  const dy = at.y - viewport.height / 2;
  return { x: cam.x + dx / cam.k - dx / k, y: cam.y + dy / cam.k - dy / k, k };
}

export function panBy(cam: Camera, dx: number, dy: number): Camera {
  return { x: cam.x - dx / cam.k, y: cam.y - dy / cam.k, k: cam.k };
}

export function tween(from: Camera, to: Camera, t: number): Camera {
  if (t >= 1) return to;
  if (t <= 0) return from;
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    k: from.k * Math.pow(to.k / from.k, t),
  };
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export function visibleRect(cam: Camera, viewport: Size): Rect {
  const hw = viewport.width / (2 * cam.k);
  const hh = viewport.height / (2 * cam.k);
  return { left: cam.x - hw, top: cam.y - hh, right: cam.x + hw, bottom: cam.y + hh };
}
