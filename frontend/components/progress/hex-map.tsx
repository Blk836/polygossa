"use client";

import { memo, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { BandSwitch, Breadcrumb, Legend, ZoomButtons, type Go } from "@/components/progress/hex-map-controls";
import { BeyondTheCore, MapTags } from "@/components/progress/hex-map-labels";
import { useMapCamera } from "@/components/progress/use-map-camera";
import { hexPath } from "@/lib/hex-grid";
import { groundOf, labelPlan, placeCamera, TILE_KINDS, tileLayers, wordFontSize, zoomLimits, type TileKind } from "@/lib/hex-view";
import { areaTiles, layoutHexWorld, TILE, type AreaShape, type HexWorld } from "@/lib/hex-world";
import type { Size } from "@/lib/map-camera";
import { regionWords, tileStats, type BandView, type MapPlace } from "@/lib/vocab-map";
import type { VocabMap, VocabMapArea, VocabMapWord } from "@/lib/types";

function useViewport(ref: RefObject<HTMLDivElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 800, height: 500 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function keyActivate(action: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    action();
  };
}

const COMPACT_BELOW_PX = 560;
const ZOOM_STEP = 1.6;
const SHADOW = TILE * 0.7;

const TILE_FILL: Record<TileKind, string> = {
  known: "var(--tile-known)",
  learning: "var(--tile-learning)",
  new: "var(--tile-new)",
  ignored: "var(--tile-later)",
  next: "var(--tile-next)",
  later: "var(--tile-later)",
};


function areaShape(world: HexWorld, regionId: string | null, areaId: string | null): AreaShape | undefined {
  return world.countries.find((c) => c.regionId === regionId)?.areas.find((a) => a.areaId === areaId);
}

export function HexMap({ map, view, top, onTop, place, selected, go, onSelect, panel }: {
  map: VocabMap;
  view: BandView;
  top: string;
  onTop: (band: string) => void;
  place: MapPlace;
  selected: string | null;
  go: Go;
  onSelect: (term: string) => void;
  panel: ReactNode;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const viewport = useViewport(frameRef);
  const world = useMemo(() => layoutHexWorld(map.regions, viewport.height > viewport.width), [map.regions, viewport]);
  const layers = useMemo(() => tileLayers(world, map.regions, view), [world, map.regions, view]);
  const limits = useMemo(() => zoomLimits(world, viewport), [world, viewport]);
  const regionId = place.region?.id ?? null;
  const areaId = place.area?.id ?? null;
  const target = useMemo(() => placeCamera(world, regionId, areaId, viewport), [world, regionId, areaId, viewport]);
  const { settled, zoomBy, handlers } = useMapCamera({ frameRef, svgRef, worldRef, viewport, world, limits, target });
  const at = settled ?? target;
  const plan = useMemo(() => labelPlan(world, at, viewport), [world, at, viewport]);
  const [pointed, setPointed] = useState<string | null>(null);
  const zoomedOut = at.k <= limits.kMin * 1.001;
  const openArea = areaShape(world, regionId, areaId);

  const zoomOut = () => {
    if (place.area) go(place.region!.id);
    else if (place.region) go(null);
    else zoomBy(1 / ZOOM_STEP);
  };

  return (
    <div ref={frameRef} className="hex-map relative aspect-[2/3] select-none overflow-hidden sm:aspect-[16/10]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        className="absolute inset-0 size-full"
        style={{ touchAction: zoomedOut ? "pan-y" : "none" }}
        role="group"
        aria-label="Hex map"
        data-testid="hex-map"
        data-zoom={at.k.toFixed(4)}
        data-centre={`${Math.round(at.x)},${Math.round(at.y)}`}
        {...handlers}
      >
        <g ref={worldRef}>
          <Ground world={world} />
          <Tiles layers={layers} />
          <Borders world={world} />
          <WordText world={world} map={map} areas={plan.words} view={view} />
          <Countries world={world} map={map} view={view} go={go} onPoint={setPointed} />
          {place.region && <Provinces world={world} regionId={place.region.id} areas={place.region.areas} view={view} go={go} />}
          {openArea && place.area && (
            <WordButtons shape={openArea} words={place.area.words} portrait={world.portrait} view={view} selected={selected} onSelect={onSelect} />
          )}
        </g>
      </svg>
      <MapTags world={world} regions={map.regions} plan={plan} view={view} camera={at} viewport={viewport}
        compact={viewport.width < COMPACT_BELOW_PX} pointed={pointed} />
      <BeyondTheCore count={map.beyondCore} world={world} />
      <Breadcrumb region={place.region} area={place.area} go={go} />
      <ZoomButtons onIn={() => zoomBy(ZOOM_STEP)} onOut={zoomOut} />
      <Legend />
      <BandSwitch bands={map.bands} top={top} onTop={onTop} />
      {panel}
    </div>
  );
}

const Ground = memo(function Ground({ world }: { world: HexWorld }) {
  return (
    <g pointerEvents="none">
      <path d={world.land} fill="var(--map-shadow)" transform={`translate(0 ${SHADOW})`} />
      <path d={world.land} fill="var(--tile-grout)" stroke="var(--tile-grout)" strokeWidth={TILE * 0.3} strokeLinejoin="round" />
    </g>
  );
});

const Tiles = memo(function Tiles({ layers }: { layers: Record<TileKind, string> }) {
  return (
    <g pointerEvents="none" data-testid="map-tiles">
      {TILE_KINDS.map((kind) => layers[kind] && <path key={kind} d={layers[kind]} fill={TILE_FILL[kind]} data-kind={kind} />)}
    </g>
  );
});

const Borders = memo(function Borders({ world }: { world: HexWorld }) {
  const line = { fill: "none", stroke: "var(--ink)", vectorEffect: "non-scaling-stroke", strokeLinecap: "round" } as const;
  return (
    <g pointerEvents="none">
      <path d={world.borders.areas} {...line} strokeOpacity={0.16} strokeWidth={1} />
      <path d={world.borders.countries} {...line} strokeOpacity={0.55} strokeWidth={1.6} />
      <path d={world.borders.coast} {...line} strokeOpacity={0.55} strokeWidth={1.8} />
    </g>
  );
});

function WordText({ world, map, areas, view }: { world: HexWorld; map: VocabMap; areas: Set<string>; view: BandView }) {
  const words = new Map(map.regions.flatMap((r) => r.areas.map((a) => [a.id, a.words] as const)));
  return (
    <g pointerEvents="none">
      {world.countries.flatMap((c) => c.areas).filter((a) => areas.has(a.areaId)).flatMap((a) =>
        areaTiles(a, words.get(a.areaId) ?? []).map((t) => (
          <text key={t.word.term} x={t.x} y={t.y} fontSize={wordFontSize(t.word.term)}
            className={`map-word-label ${view.shown.includes(t.word.band) ? "" : "faint"}`}>
            {t.word.term}
          </text>
        )))}
    </g>
  );
}

const statusOf = (w: VocabMapWord) => w.status ?? "new";

function HitArea({ ground, outline }: { ground: string; outline: string }) {
  return (
    <>
      <path d={ground} fill="transparent" />
      <path className="map-focus" d={outline} fill="none" stroke="none" />
    </>
  );
}

const Countries = memo(function Countries({ world, map, view, go, onPoint }: {
  world: HexWorld;
  map: VocabMap;
  view: BandView;
  go: Go;
  onPoint: (regionId: string | null) => void;
}) {
  const grounds = useMemo(() => world.countries.map((c) => groundOf(c.areas.flatMap((a) => a.slots), world.portrait)), [world]);
  return (
    <g>
      {world.countries.map((c, i) => {
        const region = map.regions.find((r) => r.id === c.regionId)!;
        const stats = tileStats(regionWords(region), view.shown, view.next);
        return (
          <g key={c.regionId} role="button" tabIndex={0} aria-label={`${region.name}: ${stats.known} of ${stats.total} known`}
            data-testid="map-region" data-id={c.regionId}
            onClick={() => go(c.regionId)} onKeyDown={keyActivate(() => go(c.regionId))}
            onPointerEnter={() => onPoint(c.regionId)} onPointerLeave={() => onPoint(null)}
            onFocus={() => onPoint(c.regionId)} onBlur={() => onPoint(null)}>
            <HitArea ground={grounds[i]} outline={c.outline} />
          </g>
        );
      })}
    </g>
  );
});

function Provinces({ world, regionId, areas, view, go }: { world: HexWorld; regionId: string; areas: VocabMapArea[]; view: BandView; go: Go }) {
  const country = world.countries.find((c) => c.regionId === regionId);
  return (
    <g>
      {country?.areas.map((shape) => {
        const area = areas.find((a) => a.id === shape.areaId)!;
        const stats = tileStats(area.words, view.shown, view.next);
        return (
          <g key={shape.areaId} role="button" tabIndex={0} aria-label={`${area.name}: ${stats.known} of ${stats.total} known`}
            data-testid="map-area" data-id={shape.areaId}
            onClick={() => go(regionId, shape.areaId)} onKeyDown={keyActivate(() => go(regionId, shape.areaId))}>
            <HitArea ground={groundOf(shape.slots, world.portrait)} outline={shape.outline} />
          </g>
        );
      })}
    </g>
  );
}

function WordButtons({ shape, words, portrait, view, selected, onSelect }: {
  shape: AreaShape;
  words: VocabMapWord[];
  portrait: boolean;
  view: BandView;
  selected: string | null;
  onSelect: (term: string) => void;
}) {
  return (
    <g>
      {areaTiles(shape, words).map((t) => {
        const d = hexPath(t, TILE, portrait);
        const band = view.shown.includes(t.word.band) ? "" : t.word.band === view.next ? ", next band" : ", later band";
        return (
          <g key={t.word.term} role="button" tabIndex={0} aria-label={`${t.word.term}: ${statusOf(t.word)}${band}`}
            aria-pressed={selected === t.word.term} data-testid="map-word" data-term={t.word.term} data-status={statusOf(t.word)}
            onClick={() => onSelect(t.word.term)} onKeyDown={keyActivate(() => onSelect(t.word.term))}>
            <path className="map-focus" d={d} fill="transparent" />
            {selected === t.word.term && (
              <path d={hexPath(t, TILE, portrait, 0.82)} fill="none" stroke="var(--accent)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pointerEvents="none" />
            )}
          </g>
        );
      })}
    </g>
  );
}
