"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import {
  clampCamera,
  easeInOut,
  panBy,
  toTransform,
  tween,
  zoomAt,
  type Camera,
  type Limits,
  type Size,
} from "@/lib/map-camera";
import type { Point } from "@/lib/map-geometry";

const GLIDE_MS = 550;
/** A press that moves less than this is a tap, not a drag. */
const DRAG_PX = 6;
/** How long after the last wheel or drag movement the map redraws its labels for the new zoom. */
const SETTLE_MS = 120;

function reducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

const same = (a: Camera | null, b: Camera) => !!a && a.x === b.x && a.y === b.y && a.k === b.k;

function local(svg: SVGSVGElement, e: { clientX: number; clientY: number }): Point {
  const box = svg.getBoundingClientRect();
  return { x: e.clientX - box.left, y: e.clientY - box.top };
}

const mid = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

interface Options {
  svgRef: RefObject<SVGSVGElement | null>;
  worldRef: RefObject<SVGGElement | null>;
  viewport: Size;
  world: Size;
  limits: Limits;
  /** Where the map should be: it glides there whenever this changes. */
  target: Camera;
}

/**
 * The map's camera (vocabulary-map.feature): glides to {@code target} (or jumps, for reduced motion), and follows the
 * wheel, drags and pinches in between. It moves the world by setting its transform directly, frame by frame, and
 * reports where it came to rest ({@code settled}) so the map can choose which labels to write.
 */
export function useMapCamera({ svgRef, worldRef, viewport, world, limits, target }: Options) {
  const cam = useRef<Camera | null>(null);
  const frame = useRef(0);
  const settleTimer = useRef(0);
  const shown = useRef<{ target: Camera; viewport: Size } | null>(null);
  const [settled, setSettled] = useState<Camera | null>(null);

  const draw = useCallback((c: Camera) => {
    cam.current = c;
    worldRef.current?.setAttribute("transform", toTransform(c, viewport));
    svgRef.current?.style.setProperty("--k", String(c.k));
  }, [svgRef, worldRef, viewport]);

  useLayoutEffect(() => {
    const last = shown.current;
    if (last && last.viewport === viewport && same(last.target, target)) return;
    shown.current = { target, viewport };
    cancelAnimationFrame(frame.current);
    const from = cam.current;
    if (!from || last?.viewport !== viewport || reducedMotion()) {
      draw(target);
      frame.current = requestAnimationFrame(() => setSettled(target));
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / GLIDE_MS, 1);
      draw(tween(from, target, easeInOut(t)));
      if (t < 1) frame.current = requestAnimationFrame(step);
      else setSettled(target);
    };
    frame.current = requestAnimationFrame(step);
  }, [viewport, target, draw]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(settleTimer.current);
  }, []);

  /** Moves straight to a camera (kept inside the world), stopping any glide. */
  const moveTo = useCallback((c: Camera) => {
    cancelAnimationFrame(frame.current);
    draw(clampCamera(c, world, viewport, limits));
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => cam.current && setSettled(cam.current), SETTLE_MS);
  }, [draw, world, viewport, limits]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      const c = cam.current;
      if (!c) return;
      const step = e.deltaMode === 1 ? 0.05 : 0.0015;
      const k = Math.min(Math.max(c.k * Math.exp(-e.deltaY * step), limits.kMin), limits.kMax);
      if (Math.abs(k - c.k) < 1e-9) return; // fully out (or in): the page scrolls instead
      e.preventDefault();
      moveTo(zoomAt(c, k / c.k, local(svg, e), viewport));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef, limits, viewport, moveTo]);

  return { settled, ...usePointers(cam, moveTo, viewport) };
}

/** Drags pan the map and two-finger pinches zoom it; a press that hardly moves stays a tap on whatever is under it. */
function usePointers(cam: RefObject<Camera | null>, moveTo: (c: Camera) => void, viewport: Size) {
  const pointers = useRef(new Map<number, Point>());
  const start = useRef<Point | null>(null);
  const dragging = useRef(false);
  const swallowClick = useRef(false);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.set(e.pointerId, local(e.currentTarget, e));
    swallowClick.current = false;
    if (pointers.current.size === 1) {
      start.current = local(e.currentTarget, e);
      dragging.current = false;
    }
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    const c = cam.current;
    if (!prev || !c) return;
    const p = local(e.currentTarget, e);
    pointers.current.set(e.pointerId, p);
    const other = [...pointers.current.entries()].find(([id]) => id !== e.pointerId)?.[1];
    if (other) {
      dragging.current = true;
      const was = mid(prev, other);
      const now = mid(p, other);
      const factor = Math.hypot(p.x - other.x, p.y - other.y) / Math.max(Math.hypot(prev.x - other.x, prev.y - other.y), 1);
      moveTo(panBy(zoomAt(c, factor, now, viewport), now.x - was.x, now.y - was.y));
      return;
    }
    if (!dragging.current && start.current && Math.hypot(p.x - start.current.x, p.y - start.current.y) < DRAG_PX) return;
    if (!dragging.current) {
      dragging.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    moveTo(panBy(c, p.x - prev.x, p.y - prev.y));
  };

  const onPointerEnd = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0 && dragging.current) {
      swallowClick.current = true;
      dragging.current = false;
    }
  };

  /** The click that ends a drag or pinch is not a tap. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture };
}
