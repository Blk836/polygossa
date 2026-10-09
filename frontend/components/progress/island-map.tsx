"use client";

import { memo, useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { BeyondTheCore, PlaceLabels, WordLabels, keyActivate, landFill, type AreaDots } from "@/components/progress/island-map-labels";
import { useMapCamera } from "@/components/progress/use-map-camera";
import { labelPlan, layoutWorld, PLACE_MARGIN, placeCircle, provinceDots, zoomLimits, type World } from "@/lib/island-world";
import { fitCircle, type Camera, type Size } from "@/lib/map-camera";
import { areaWords, coverage, regionWords, tileStats, type BandView, type MapPlace } from "@/lib/vocab-map";
import type { VocabMap, VocabMapWord } from "@/lib/types";

type Go = (regionId: string | null, areaId?: string | null) => void;

/** The map's size on screen, followed as the card resizes. */
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

/** Each province's dots for the bands shown: the counted words, then the next band's, faint. */
function dotsByArea(world: World, view: BandView): Map<string, AreaDots> {
  const out = new Map<string, AreaDots>();
  for (const isle of world.islands) {
    for (const p of isle.provinces) out.set(p.area.id, provinceDots(p, areaWords(p.area, view.shown, view.next)));
  }
  return out;
}

/** Narrower maps (phones) write island labels small, on two lines, without the notes, so neighbours don't collide. */
const COMPACT_BELOW_PX = 560;

const STATUS_TEXT: Record<string, string> = { known: "known", learning: "learning", ignored: "ignored", new: "new" };

const dotFill: Record<string, string> = {
  known: "var(--w-known-line)",
  learning: "var(--w-learning-line)",
  new: "var(--dot-new)",
  ignored: "none",
};

/**
 * The vocabulary map as an island world (vocabulary-map.feature): an island per region, a province per area, a dot per
 * word. Tapping glides in a level; the wheel, drags and pinches zoom and pan freely in between.
 */
export function IslandMap({ map, view, place, selected, go, onSelect }: {
  map: VocabMap;
  view: BandView;
  place: MapPlace;
  selected: string | null;
  go: Go;
  onSelect: (term: string) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const viewport = useViewport(wrapRef);
  const portrait = viewport.height > viewport.width;
  const world = useMemo(() => layoutWorld(map.regions, portrait), [map.regions, portrait]);
  const dots = useMemo(() => dotsByArea(world, view), [world, view]);
  const limits = useMemo(() => zoomLimits(world, viewport), [world, viewport]);
  const regionId = place.region?.id ?? null;
  const areaId = place.area?.id ?? null;
  const target = useMemo<Camera>(() => {
    const circle = placeCircle(world, regionId, areaId);
    return circle ? fitCircle(circle, viewport, PLACE_MARGIN) : { x: world.width / 2, y: world.height / 2, k: limits.kMin };
  }, [world, regionId, areaId, viewport, limits]);
  const { settled, ...handlers } = useMapCamera({ svgRef, worldRef, viewport, world, limits, target });
  const at = settled ?? target;
  const plan = useMemo(() => labelPlan(world, at, viewport, (id) => dots.get(id)?.spacing ?? 0), [world, at, viewport, dots]);
  const zoomedOut = at.k <= limits.kMin * 1.001;

  return (
    <div
      ref={wrapRef}
      className="relative -mx-5 aspect-[2/3] overflow-hidden sm:mx-0 sm:aspect-[16/10] sm:rounded-lg sm:border sm:border-line"
      style={{ background: "var(--sea-deep)" }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        className="island-map absolute inset-0 size-full select-none"
        style={{ touchAction: zoomedOut ? "pan-y" : "none" }}
        role="group"
        aria-label="Island map"
        data-testid="island-map"
        data-zoom={at.k.toFixed(4)}
        data-centre={`${Math.round(at.x)},${Math.round(at.y)}`}
        {...handlers}
      >
        <g ref={worldRef}>
          <rect width={world.width} height={world.height} fill="var(--sea)" />
          <Shallows world={world} />
          {world.islands.map((isle) => {
            const stats = tileStats(regionWords(isle.region), view.shown, view.next);
            return (
              <g
                key={isle.region.id}
                role="button"
                tabIndex={0}
                aria-label={`${isle.region.name}: ${stats.known} of ${stats.total} known`}
                data-testid="map-island"
                data-id={isle.region.id}
                onClick={() => go(isle.region.id)}
                onKeyDown={keyActivate(() => go(isle.region.id))}
              >
                {isle.coast.map((d, i) => <path key={i} className="map-focus" d={d} fill={landFill(coverage(stats))} />)}
              </g>
            );
          })}
          <Provinces world={world} view={view} regionId={regionId} go={go} />
          <Dots dots={dots} />
          {place.area && (
            <WordButtons dots={dots.get(place.area.id)} selected={selected} onSelect={onSelect} />
          )}
          <WordLabels plan={plan} dots={dots} />
          <PlaceLabels plan={plan} world={world} view={view} compact={viewport.width < COMPACT_BELOW_PX} />
          <BeyondTheCore count={map.beyondCore} world={world} />
        </g>
      </svg>
      {place.region && (
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => go(place.area ? place.region!.id : null)}
          className="absolute right-3 top-3 grid size-10 place-items-center rounded-full border border-line bg-card text-xl leading-none shadow-sm"
        >
          −
        </button>
      )}
    </div>
  );
}

const Shallows = memo(function Shallows({ world }: { world: World }) {
  return (
    <g fill="var(--sea-shallow)" pointerEvents="none">
      {world.islands.flatMap((isle) => isle.shallowsPaths.map((d, i) => <path key={`${isle.region.id}-${i}`} d={d} />))}
    </g>
  );
});

/** Every province, coloured by its own coverage; the open island's provinces are buttons into them. */
function Provinces({ world, view, regionId, go }: { world: World; view: BandView; regionId: string | null; go: Go }) {
  return (
    <g>
      {world.islands.flatMap((isle) => isle.provinces.map((p) => {
        const stats = tileStats(p.area.words, view.shown, view.next);
        const shape = <path className="map-focus" d={p.land} fill={landFill(coverage(stats))} />;
        if (isle.region.id !== regionId) return <g key={p.area.id} pointerEvents="none">{shape}</g>;
        return (
          <g
            key={p.area.id}
            role="button"
            tabIndex={0}
            aria-label={`${p.area.name}: ${stats.known} of ${stats.total} known`}
            data-testid="map-province"
            data-id={p.area.id}
            onClick={() => go(isle.region.id, p.area.id)}
            onKeyDown={keyActivate(() => go(isle.region.id, p.area.id))}
          >
            {shape}
          </g>
        );
      }))}
    </g>
  );
}

/** A dot per word: green known, yellow learning, grey new, the next band's as faint rings. Texture until zoomed in. */
const Dots = memo(function Dots({ dots }: { dots: Map<string, AreaDots> }) {
  return (
    <g pointerEvents="none">
      {[...dots.values()].flatMap(({ dots: list, spacing }) => list.map((d) => <Dot key={d.word.term} word={d.word} faint={d.faint} x={d.x} y={d.y} r={spacing * 0.26} />))}
    </g>
  );
});

function Dot({ word, faint, x, y, r }: { word: VocabMapWord; faint: boolean; x: number; y: number; r: number }) {
  const status = word.status ?? "new";
  if (faint || status === "ignored") {
    return <circle cx={x} cy={y} r={r * 0.8} fill="none" stroke="var(--dot-new)" strokeWidth={r * 0.3} strokeDasharray={faint ? `${r * 0.5} ${r * 0.4}` : undefined} opacity={faint ? 0.7 : 1} />;
  }
  return <circle cx={x} cy={y} r={r} fill={dotFill[status]} stroke="var(--card)" strokeWidth={r * 0.3} />;
}

/** The open province's words as buttons: a tap (or Enter) opens the word's panel. */
function WordButtons({ dots, selected, onSelect }: { dots: AreaDots | undefined; selected: string | null; onSelect: (term: string) => void }) {
  if (!dots) return null;
  const hit = dots.spacing * 0.6;
  return (
    <g>
      {dots.dots.map((d) => {
        const status = d.word.status ?? "new";
        return (
          <g
            key={d.word.term}
            role="button"
            tabIndex={0}
            aria-label={`${d.word.term}: ${STATUS_TEXT[status]}${d.faint ? ", next band" : ""}`}
            aria-pressed={selected === d.word.term}
            data-testid="map-word"
            data-term={d.word.term}
            data-status={status}
            onClick={() => onSelect(d.word.term)}
            onKeyDown={keyActivate(() => onSelect(d.word.term))}
          >
            <circle className="map-focus" cx={d.x} cy={d.y} r={hit} fill="transparent" />
            {selected === d.word.term && (
              <circle cx={d.x} cy={d.y} r={dots.spacing * 0.42} fill="none" stroke="var(--accent)" strokeWidth={dots.spacing * 0.08} />
            )}
          </g>
        );
      })}
    </g>
  );
}
