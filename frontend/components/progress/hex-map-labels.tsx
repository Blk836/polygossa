"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import type { LabelPlan } from "@/lib/hex-view";
import type { HexWorld } from "@/lib/hex-world";
import type { Point } from "@/lib/map-geometry";
import type { VocabMapRegion, VocabMapWord } from "@/lib/types";
import { regionWords, tileStats, type BandView } from "@/lib/vocab-map";

/** Where a tag sits: its world point, which the frame's camera variables turn into a place on screen. */
const at = (p: Point) => ({ "--x": p.x, "--y": p.y }) as CSSProperties;

/** A name on two lines, split after "&" ("Food &" / "Drink"), for phones, where countries sit close together. */
function Name({ name, compact, display }: { name: string; compact: boolean; display: boolean }) {
  const [first, ...rest] = name.split(" & ");
  const className = `name ${display ? "font-display" : ""}`;
  if (!compact || rest.length === 0) return <span className={className}>{name}</span>;
  return <span className={className}>{first} &amp;<br />{rest.join(" & ")}</span>;
}

/**
 * A country's or province's name tag: its name, a small progress bar and "40 / 62", then "3 learning · +18 at A2"
 * when there is any (a country's only while it is pointed at or focused).
 */
function Tag({ id, kind, name, words, view, where, compact, more }: {
  id: string;
  kind: "country" | "area";
  name: string;
  words: VocabMapWord[];
  view: BandView;
  where: Point;
  compact: boolean;
  more: boolean;
}) {
  const stats = tileStats(words, view.shown, view.next);
  const share = (n: number) => `${stats.total ? (n / stats.total) * 100 : 0}%`;
  const notes = [
    stats.learning > 0 && <span key="l" data-testid="tile-learning">{stats.learning} learning</span>,
    view.next && stats.next > 0 && <span key="n" data-testid="tile-next">+{stats.next} at {view.next}</span>,
  ].filter(Boolean);
  return (
    <div
      className={`map-tag ${kind} ${compact ? "compact" : ""} ${more ? "open-more" : ""}`}
      style={at(where)}
      data-testid={kind === "country" ? "region-label" : "area-label"}
      data-id={id}
    >
      <Name name={name} compact={compact} display={kind === "country"} />
      <span className="chip">
        <span className="bar" aria-hidden>
          <i style={{ width: share(stats.known), background: "var(--tile-known)" }} />
          <i style={{ width: share(stats.learning), background: "var(--tile-learning)" }} />
        </span>
        <span data-testid="tile-count">{stats.known} / {stats.total}</span>
      </span>
      {notes.length > 0 && (
        <span className="more">{notes.flatMap((n, i) => (i ? [<span key={`s${i}`}> · </span>, n] : [n]))}</span>
      )}
    </div>
  );
}

/** Country names far out, the names of an open country's provinces closer in; HTML over the map, the same size at every zoom. */
export function MapTags({ world, regions, plan, view, compact, pointed }: {
  world: HexWorld;
  regions: VocabMapRegion[];
  plan: LabelPlan;
  view: BandView;
  compact: boolean;
  /** The country pointed at or focused, whose tag shows more. */
  pointed: string | null;
}) {
  const byId = new Map(regions.map((r) => [r.id, r]));
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {world.countries.map((c) => {
        const region = byId.get(c.regionId);
        if (!region) return null;
        if (plan.countries.has(c.regionId)) {
          return <Tag key={c.regionId} id={c.regionId} kind="country" name={region.name} words={regionWords(region)} view={view}
            where={c.centre} compact={compact} more={pointed === c.regionId} />;
        }
        return c.areas.map((a) => {
          const area = region.areas.find((x) => x.id === a.areaId);
          return area && plan.areas.has(a.areaId) && (
            <Tag key={a.areaId} id={a.areaId} kind="area" name={area.name} words={area.words} view={view} where={a.centre} compact={false} more />
          );
        });
      })}
    </div>
  );
}

/** Known words outside the list: the uncharted sea off the coast, a way into Vocabulary's known words. */
export function BeyondTheCore({ count, world }: { count: number; world: HexWorld }) {
  const router = useRouter();
  const href = "/vocabulary?status=known";
  return (
    <a
      href={href}
      data-testid="beyond-core"
      aria-label={`Beyond the core: ${count.toLocaleString()} words`}
      className="map-tag text-muted italic hover:underline"
      style={at(world.beyond)}
      onClick={(e) => {
        e.preventDefault();
        router.push(href);
      }}
    >
      <span className="name font-display text-ink">Beyond the core</span>
      <span>{count.toLocaleString()} words</span>
    </a>
  );
}
