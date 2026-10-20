"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export interface Point {
  label: string;
  value: number;
}

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };

function useWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function niceMax(v: number) {
  if (v <= 5) return 5;
  const mag = 10 ** Math.floor(Math.log10(v));
  return Math.ceil(v / mag) * mag;
}

const shortDate = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Frame({ title, unit, points, children }: { title: string; unit: string; points: Point[]; children: ReactNode }) {
  const [table, setTable] = useState(false);
  return (
    <figure className="viz rounded-xl border border-line bg-card p-4">
      <figcaption className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium">{title}</h2>
        <button className="text-xs text-muted underline" onClick={() => setTable(!table)} aria-pressed={table}>
          {table ? "Chart" : "Table"}
        </button>
      </figcaption>
      {table ? (
        <div className="max-h-48 overflow-auto text-sm">
          <table className="w-full">
            <thead><tr className="text-left text-muted"><th className="font-normal">Date</th><th className="text-right font-normal">{unit}</th></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.label} className="border-t border-line"><td>{shortDate(p.label)}</td><td className="text-right tabular-nums">{p.value.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

function Axes({ width, max, points, x }: { width: number; max: number; points: Point[]; x: (i: number) => number }) {
  const ticks = [0, max / 2, max];
  const y = (v: number) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - v / max);
  const labelEvery = Math.ceil(points.length / Math.max(2, Math.floor(width / 90)));
  return (
    <g fontSize="11" fill="var(--viz-text-muted)">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" strokeWidth={1} />
          <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end">{Math.round(t).toLocaleString()}</text>
        </g>
      ))}
      {points.map((p, i) =>
        i % labelEvery === 0 ? (
          <text key={p.label} x={x(i)} y={HEIGHT - 6} textAnchor={i === points.length - 1 ? "end" : "middle"}>{shortDate(p.label)}</text>
        ) : null,
      )}
    </g>
  );
}

function Tooltip({ left, top, value, label, unit }: { left: number; top: number; value: number; label: string; unit: string }) {
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-card px-2 py-1 text-xs shadow"
      style={{ left, top: top - 8 }}
    >
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-3" style={{ background: "var(--viz-series-1)" }} />
        <strong className="tabular-nums">{value.toLocaleString()}</strong> <span className="text-muted">{unit}</span>
      </div>
      <div className="text-muted">{shortDate(label)}</div>
    </div>
  );
}

export function LineChart({ title, unit, points }: { title: string; unit: string; points: Point[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.map((p) => p.value), 1));
  const x = (i: number) => PAD.left + ((width - PAD.left - PAD.right) * i) / Math.max(1, points.length - 1);
  const y = (v: number) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - v / max);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.value)}`).join(" ");
  const last = points.length - 1;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * (width - PAD.left - PAD.right);
    setHover(Math.max(0, Math.min(last, Math.round((rel / (width - PAD.left - PAD.right)) * last))));
  }

  return (
    <Frame title={title} unit={unit} points={points}>
      <div ref={ref} className="relative">
        <svg width={width} height={HEIGHT} role="img" aria-label={`${title}: ${points.at(-1)?.value ?? 0} ${unit} at the end of the period`}>
          <Axes width={width} max={max} points={points} x={x} />
          <path d={d} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinejoin="round" />
          {last >= 0 && (
            <>
              <circle cx={x(last)} cy={y(points[last].value)} r={4} fill="var(--viz-series-1)" stroke="var(--card)" strokeWidth={2} />
              <text x={x(last) - 6} y={y(points[last].value) - 8} textAnchor="end" fontSize="11" fill="var(--viz-text)">
                {points[last].value.toLocaleString()}
              </text>
            </>
          )}
          {hover !== null && (
            <>
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--viz-text-muted)" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(points[hover].value)} r={4} fill="var(--viz-series-1)" stroke="var(--card)" strokeWidth={2} />
            </>
          )}
          <rect
            x={PAD.left} y={PAD.top} width={width - PAD.left - PAD.right} height={HEIGHT - PAD.top - PAD.bottom}
            fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)}
          />
        </svg>
        {hover !== null && <Tooltip left={x(hover)} top={y(points[hover].value)} value={points[hover].value} label={points[hover].label} unit={unit} />}
      </div>
    </Frame>
  );
}

export function BarChart({ title, unit, points }: { title: string; unit: string; points: Point[] }) {
  const { ref, width } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(...points.map((p) => p.value), 1));
  const slot = (width - PAD.left - PAD.right) / Math.max(1, points.length);
  const barW = Math.max(2, slot - 2);
  const x = (i: number) => PAD.left + slot * i + slot / 2;
  const y = (v: number) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - v / max);
  const base = HEIGHT - PAD.bottom;

  return (
    <Frame title={title} unit={unit} points={points}>
      <div ref={ref} className="relative">
        <svg width={width} height={HEIGHT} role="img" aria-label={title}>
          <Axes width={width} max={max} points={points} x={x} />
          {points.map((p, i) => {
            const h = base - y(p.value);
            const r = Math.min(4, barW / 2, h);
            const left = x(i) - barW / 2;
            const path = h <= 0 ? "" :
              `M${left},${base} V${base - h + r} Q${left},${base - h} ${left + r},${base - h} H${left + barW - r} Q${left + barW},${base - h} ${left + barW},${base - h + r} V${base} Z`;
            return (
              <g key={p.label}>
                {path && <path d={path} fill="var(--viz-series-1)" opacity={hover === null || hover === i ? 1 : 0.55} />}
                <rect
                  x={x(i) - slot / 2} y={PAD.top} width={slot} height={base - PAD.top} fill="transparent"
                  tabIndex={0} aria-label={`${shortDate(p.label)}: ${p.value} ${unit}`}
                  onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                />
              </g>
            );
          })}
        </svg>
        {hover !== null && <Tooltip left={x(hover)} top={y(points[hover].value)} value={points[hover].value} label={points[hover].label} unit={unit} />}
      </div>
    </Frame>
  );
}
