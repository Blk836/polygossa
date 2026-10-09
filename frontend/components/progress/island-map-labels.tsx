"use client";

import { useRouter } from "next/navigation";
import { BEYOND, type Dot, type LabelPlan, type World } from "@/lib/island-world";
import { tileStats, regionWords, type BandView } from "@/lib/vocab-map";
import type { VocabMapWord } from "@/lib/types";

export interface AreaDots {
  dots: Dot[];
  spacing: number;
}

/** Enter and Space press a map button, as they do a real one. */
export function keyActivate(action: () => void) {
  return (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    action();
  };
}

/** Land from pale (nothing known) to rich green (everything known). */
export function landFill(percent: number): string {
  return `color-mix(in oklab, var(--land-rich) ${percent}%, var(--land))`;
}

/** "40 / 62", then "3 learning · +18 at B1" when there are any. Drawn at a fixed size on screen, whatever the zoom. */
function Counts({ id, testId, name, words, view, x, y }: {
  id: string;
  testId: string;
  name: string;
  words: VocabMapWord[];
  view: BandView;
  x: number;
  y: number;
}) {
  const stats = tileStats(words, view.shown, view.next);
  const notes = [
    stats.learning > 0 && <tspan key="l" data-testid="tile-learning">{stats.learning} learning</tspan>,
    view.next && stats.next > 0 && <tspan key="n" data-testid="tile-next">+{stats.next} at {view.next}</tspan>,
  ].filter(Boolean);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="map-label" data-testid={testId} data-id={id}>
        <text className="name" y={-5}>{name}</text>
        <text y={11} data-testid="tile-count">{stats.known} / {stats.total}</text>
        {notes.length > 0 && (
          <text className="note" y={25}>{notes.flatMap((n, i) => (i ? [<tspan key={`s${i}`}> · </tspan>, n] : [n]))}</text>
        )}
      </g>
    </g>
  );
}

/** Island names far out; the names of an island's provinces once it fills the map. */
export function PlaceLabels({ plan, world, view }: { plan: LabelPlan; world: World; view: BandView }) {
  return (
    <g pointerEvents="none">
      {world.islands.map((isle) => plan.islands.has(isle.region.id) && (
        <Counts key={isle.region.id} id={isle.region.id} testId="island-label" name={isle.region.name}
          words={regionWords(isle.region)} view={view} x={isle.circle.x} y={isle.circle.y} />
      ))}
      {world.islands.flatMap((isle) => isle.provinces.map((p) => plan.provinces.has(p.area.id) && (
        <Counts key={p.area.id} id={p.area.id} testId="province-label" name={p.area.name}
          words={p.area.words} view={view} x={p.circle.x} y={p.circle.y} />
      )))}
    </g>
  );
}

/** Up close, each dot has its word written under it. */
export function WordLabels({ plan, dots }: { plan: LabelPlan; dots: Map<string, AreaDots> }) {
  return (
    <g pointerEvents="none">
      {[...plan.words].flatMap((areaId) => {
        const area = dots.get(areaId);
        if (!area) return [];
        const size = area.spacing * 0.24;
        return area.dots.map((d) => (
          <text key={d.word.term} className="map-word-label" x={d.x} y={d.y + area.spacing * 0.26 + size} fontSize={size}
            strokeWidth={size * 0.25} opacity={d.faint ? 0.65 : 1}>
            {d.word.term}
          </text>
        ));
      })}
    </g>
  );
}

/** Known words outside the list: the uncharted sea in the world's corner, a way into Vocabulary's known words. */
export function BeyondTheCore({ count }: { count: number }) {
  const router = useRouter();
  const href = "/vocabulary?status=known";
  return (
    <a
      href={href}
      data-testid="beyond-core"
      aria-label={`Beyond the core: ${count.toLocaleString()} words`}
      onClick={(e) => {
        e.preventDefault();
        router.push(href);
      }}
    >
      <g transform={`translate(${BEYOND.x} ${BEYOND.y})`}>
        {[40, 75, 110].map((r) => (
          <circle key={r} r={r} fill="none" stroke="var(--muted)" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="6 8" />
        ))}
        <circle className="map-focus" r={110} fill="transparent" />
        <g className="map-label beyond">
          <text className="name" x={-24} y={-5}>Beyond the core</text>
          <text x={-24} y={11}>{count.toLocaleString()} words</text>
        </g>
      </g>
    </a>
  );
}
