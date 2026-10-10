"use client";

import type { MapPlace } from "@/lib/vocab-map";

export type Go = (regionId: string | null, areaId?: string | null) => void;

const crumbClass = "rounded-lg px-2 py-1";

export function Breadcrumb({ region, area, go }: MapPlace & { go: Go }) {
  const link = `${crumbClass} text-accent hover:bg-accent-soft`;
  const here = `${crumbClass} font-semibold`;
  const sep = <span aria-hidden className="text-muted">›</span>;
  return (
    <nav aria-label="Map location" data-testid="map-breadcrumb"
      className="map-glass left-3 top-3 flex max-w-[calc(100%-5rem)] flex-wrap items-center gap-0.5 p-1 text-sm">
      {region ? <button type="button" className={link} onClick={() => go(null)}>Map</button> : <span className={here}>Map</span>}
      {region && sep}
      {region && area && <button type="button" className={link} onClick={() => go(region.id)}>{region.name}</button>}
      {region && !area && <span className={here}>{region.name}</span>}
      {area && sep}
      {area && <span className={here}>{area.name}</span>}
    </nav>
  );
}

const zoomClass = "grid size-9 place-items-center rounded-lg text-lg leading-none hover:bg-accent-soft";

export function ZoomButtons({ onIn, onOut }: { onIn: () => void; onOut: () => void }) {
  return (
    <div className="map-glass right-3 top-3 grid gap-0.5 p-1">
      <button type="button" aria-label="Zoom in" className={zoomClass} onClick={onIn}>+</button>
      <hr className="mx-1 border-line" />
      <button type="button" aria-label="Zoom out" className={zoomClass} onClick={onOut}>−</button>
    </div>
  );
}

export function BandSwitch({ bands, top, onTop }: { bands: string[]; top: string; onTop: (band: string) => void }) {
  return (
    <div role="group" aria-label="Bands counted" className="map-glass bottom-3 right-3 flex gap-0.5 p-1">
      {bands.map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={b === top}
          onClick={() => onTop(b)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${b === top ? "bg-accent text-accent-ink" : "text-muted hover:bg-accent-soft"}`}
        >
          Up to {b}
        </button>
      ))}
    </div>
  );
}

const SWATCHES: [string, string][] = [["Known", "--tile-known"], ["Learning", "--tile-learning"], ["New", "--tile-new"]];

export function Legend() {
  return (
    <div className="map-glass bottom-3 left-3 hidden items-center gap-3 px-3 py-2 text-xs text-muted sm:flex" data-testid="map-legend">
      {SWATCHES.map(([name, colour]) => (
        <span key={name} className="flex items-center gap-1.5">
          <i aria-hidden className="inline-block size-2.5 rounded-sm border border-line" style={{ background: `var(${colour})` }} />
          {name}
        </span>
      ))}
    </div>
  );
}
