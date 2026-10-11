"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Polly } from "./polly";

const EVENT = "polly-known";
const MARKING = "polly-marking";
const FLIGHT_MS = 700;
const SIZE = 24;

interface Box { x: number; y: number }
export interface Flight { id: number; from: Box; to: Box }

const centre = (r: DOMRect): Box => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

export function expectPolly() {
  window.dispatchEvent(new Event(MARKING));
}

export function sendPollyFrom(element: Element | null) {
  const rect = element?.getBoundingClientRect();
  if (rect && rect.width > 0) window.dispatchEvent(new CustomEvent<Box>(EVENT, { detail: centre(rect) }));
}

function onScreen(r: DOMRect | undefined): r is DOMRect {
  return !!r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
}

function stillMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function usePollyFlights(target: () => Element | null, on: { mark: () => void; takeOff: () => void }): [Flight | null, () => void] {
  const [flight, setFlight] = useState<Flight | null>(null);
  const busy = useRef(false);
  const handlers = useRef(on);
  useEffect(() => {
    handlers.current = on;
  }, [on]);
  useEffect(() => {
    const listen = (e: Event) => {
      const to = target()?.getBoundingClientRect();
      if (busy.current || stillMotion() || !onScreen(to)) return;
      busy.current = true;
      handlers.current.takeOff();
      setFlight({ id: Date.now(), from: (e as CustomEvent<Box>).detail, to: centre(to) });
    };
    const mark = () => handlers.current.mark();
    window.addEventListener(EVENT, listen);
    window.addEventListener(MARKING, mark);
    return () => {
      window.removeEventListener(EVENT, listen);
      window.removeEventListener(MARKING, mark);
    };
  }, [target]);
  const land = () => {
    busy.current = false;
    setFlight(null);
  };
  return [flight, land];
}

export function PollyFlight({ flight, onLand }: { flight: Flight; onLand: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const landed = useRef(onLand);
  useEffect(() => {
    landed.current = onLand;
  }, [onLand]);
  useEffect(() => {
    const { from, to } = flight;
    const at = (p: Box, scale = 1) => `translate(${p.x - SIZE / 2}px, ${p.y - SIZE / 2}px) scale(${scale})`;
    const top: Box = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 60 };
    const animation = ref.current!.animate(
      [{ transform: at(from, 0.6) }, { transform: at(top, 1.1) }, { transform: at(to, 0.8) }],
      { duration: FLIGHT_MS, easing: "ease-in-out", fill: "forwards" },
    );
    const done = () => landed.current();
    animation.onfinish = done;
    animation.oncancel = done;
    return () => {
      animation.onfinish = null;
      animation.oncancel = null;
      animation.cancel();
    };
  }, [flight]);
  return createPortal(
    <div ref={ref} data-testid="polly-flight" aria-hidden className="pointer-events-none fixed left-0 top-0 z-50" style={{ width: SIZE, height: SIZE }}>
      <Polly size="small" className="size-full" />
    </div>,
    document.body,
  );
}
