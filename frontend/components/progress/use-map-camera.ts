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
const DRAG_PX = 6;
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
  frameRef: RefObject<HTMLDivElement | null>;
  svgRef: RefObject<SVGSVGElement | null>;
  worldRef: RefObject<SVGGElement | null>;
  viewport: Size;
  world: Size;
  limits: Limits;
  target: Camera;
}

export function useMapCamera({ frameRef, svgRef, worldRef, viewport, world, limits, target }: Options) {
  const cam = useRef<Camera | null>(null);
  const frame = useRef(0);
  const settleTimer = useRef(0);
  const shown = useRef<{ target: Camera; viewport: Size } | null>(null);
  const [settled, setSettled] = useState<Camera | null>(null);

  const draw = useCallback((c: Camera) => {
    cam.current = c;
    worldRef.current?.setAttribute("transform", toTransform(c, viewport));
    const style = frameRef.current?.style;
    style?.setProperty("--k", String(c.k));
    style?.setProperty("--tx", String(viewport.width / 2 - c.x * c.k));
    style?.setProperty("--ty", String(viewport.height / 2 - c.y * c.k));
  }, [frameRef, worldRef, viewport]);

  const glide = useCallback((to: Camera, jump: boolean) => {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(settleTimer.current);
    const from = cam.current;
    if (!from || jump || reducedMotion()) {
      draw(to);
      frame.current = requestAnimationFrame(() => setSettled(to));
      return;
    }
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min((now - start) / GLIDE_MS, 1);
      draw(tween(from, to, easeInOut(t)));
      if (t < 1) frame.current = requestAnimationFrame(step);
      else setSettled(to);
    };
    frame.current = requestAnimationFrame(step);
  }, [draw]);

  useLayoutEffect(() => {
    const last = shown.current;
    if (last && last.viewport === viewport && same(last.target, target)) return;
    shown.current = { target, viewport };
    glide(target, last?.viewport !== viewport);
  }, [viewport, target, glide]);

  const zoomBy = useCallback((factor: number) => {
    const c = cam.current;
    if (!c) return;
    const middle = { x: viewport.width / 2, y: viewport.height / 2 };
    glide(clampCamera(zoomAt(c, factor, middle, viewport), world, viewport, limits), false);
  }, [glide, world, viewport, limits]);

  useEffect(() => () => {
    cancelAnimationFrame(frame.current);
    window.clearTimeout(settleTimer.current);
  }, []);

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
      if (Math.abs(k - c.k) < 1e-9) return;
      e.preventDefault();
      moveTo(zoomAt(c, k / c.k, local(svg, e), viewport));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [svgRef, limits, viewport, moveTo]);

  return { settled, zoomBy, handlers: usePointers(cam, moveTo, viewport) };
}

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

  const onClickCapture = (e: React.MouseEvent) => {
    if (!swallowClick.current) return;
    swallowClick.current = false;
    e.stopPropagation();
    e.preventDefault();
  };

  return { onPointerDown, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd, onClickCapture };
}
