"use client";

import { useRouter } from "next/navigation";
import type { Dot, LabelPlan, World } from "@/lib/island-world";
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

/** A name on two lines, split after "&" ("Food &" / "Drink"), for small maps where islands sit close together. */
function CompactName({ name }: { name: string }) {
  const [first, ...rest] = name.split(" & ");
  if (rest.length === 0) return <text className="name small" y={-3}>{name}</text>;
  return (
    <text className="name small" y={-13}>
      <tspan x={0}>{first} &amp;</tspan>
      <tspan x={0} dy={11}>{rest.join(" & ")}</tspan>
    </text>
  );
}

/**
 * The name and "40 / 62", then "3 learning · +18 at B1" when there are any (left out when compact). Drawn at a fixed
 * size on screen, whatever the zoom.
 */
function Counts({ id, testId, name, words, view, x, y, compact = false }: {
  id: string;
  testId: string;
  name: string;
  words: VocabMapWord[];
  view: BandView;
  x: number;
  y: number;
  compact?: boolean;
}) {
  const stats = tileStats(words, view.shown, view.next);
  const notes = compact ? [] : [
    stats.learning > 0 && <tspan key="l" data-testid="tile-learning">{stats.learning} learning</tspan>,
    view.next && stats.next > 0 && <tspan key="n" data-testid="tile-next">+{stats.next} at {view.next}</tspan>,
  ].filter(Boolean);
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="map-label" data-testid={testId} data-id={id}>
        {compact ? <CompactName name={name} /> : <text className="name" y={-5}>{name}</text>}
        <text className={compact ? "small" : undefined} y={compact ? 9 : 11} data-testid="tile-count">{stats.known} / {stats.total}</text>
        {notes.length > 0 && (
          <text className="note" y={25}>{notes.flatMap((n, i) => (i ? [<tspan key={`s${i}`}> · </tspan>, n] : [n]))}</text>
        )}
      </g>
    </g>
  );
}

/** Island names far out; the names of an island's provinces once it fills the map. */
export function PlaceLabels({ plan, world, view, compact }: { plan: LabelPlan; world: World; view: BandView; compact: boolean }) {
  return (
    <g pointerEvents="none">
      {world.islands.map((isle) => plan.islands.has(isle.region.id) && (
        <Counts key={isle.region.id} id={isle.region.id} testId="island-label" name={isle.region.name}
          words={regionWords(isle.region)} view={view} x={isle.circle.x} y={isle.circle.y} compact={compact} />
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
export function BeyondTheCore({ count, world }: { count: number; world: World }) {
  const router = useRouter();
  const href = "/vocabulary?status=known";
  const at = world.beyond;
  // Written inwards from the corner, so it is never cut off by the world's edge.
  const right = at.x > world.width / 2;
  const x = right ? 24 : -24;
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
      <g transform={`translate(${at.x} ${at.y})`}>
        {[40, 75, 110].map((r) => (
          <circle key={r} r={r} fill="none" stroke="var(--muted)" strokeOpacity={0.35} strokeWidth={2} strokeDasharray="6 8" />
        ))}
        <circle className="map-focus" r={110} fill="transparent" />
        <g className={`map-label beyond ${right ? "end" : ""}`}>
          <text className="name" x={x} y={-5}>Beyond the core</text>
          <text x={x} y={11}>{count.toLocaleString()} words</text>
        </g>
      </g>
    </a>
  );
}
