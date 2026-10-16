"use client";

import { useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { fitTags, type LabelPlan, type TagFit } from "@/lib/hex-view";
import type { HexWorld } from "@/lib/hex-world";
import type { Camera, Size } from "@/lib/map-camera";
import type { Point } from "@/lib/map-geometry";
import type { VocabMapRegion, VocabMapWord } from "@/lib/types";
import { regionWords, tileStats, type BandView, type TileStats } from "@/lib/vocab-map";

const at = (p: Point) => ({ "--x": p.x, "--y": p.y }) as CSSProperties;

function Name({ name, compact, display }: { name: string; compact: boolean; display: boolean }) {
  const [first, ...rest] = name.split(" & ");
  const className = `name ${display ? "font-display" : ""}`;
  if (!compact || rest.length === 0) return <span className={className}>{name}</span>;
  return <span className={className}>{first} &amp;<br />{rest.join(" & ")}</span>;
}

function Tag({ id, kind, name, words, view, where, compact, more, fit = FULL }: {
  id: string;
  kind: "country" | "area";
  name: string;
  words: VocabMapWord[];
  view: BandView;
  where: Point;
  compact: boolean;
  more: boolean;
  fit?: TagFit;
}) {
  const stats = tileStats(words, view.shown, view.next);
  const share = (n: number) => `${stats.total ? (n / stats.total) * 100 : 0}%`;
  const count = fit.show === "full";
  return (
    <div
      className={`map-tag ${kind} ${compact ? "compact" : ""} ${more ? "open-more" : ""}`}
      style={{ ...at(where), marginLeft: fit.dx, marginTop: fit.dy }}
      data-testid={kind === "country" ? "region-label" : "area-label"}
      data-id={id}
    >
      <Name name={name} compact={compact} display={kind === "country"} />
      {count && <span className="chip">
        <span className="bar" aria-hidden>
          <i style={{ width: share(stats.known), background: "var(--tile-known)" }} />
          <i style={{ width: share(stats.learning), background: "var(--tile-learning)" }} />
        </span>
        <span data-testid="tile-count">{stats.known} / {stats.total}</span>
      </span>}
      {count && <Notes stats={stats} next={view.next} />}
    </div>
  );
}

const NOTE_GAP = " · ";

function noteList(stats: TileStats, next: string | null): { id: string; text: string }[] {
  return [
    ...(stats.learning > 0 ? [{ id: "tile-learning", text: `${stats.learning} learning` }] : []),
    ...(next && stats.next > 0 ? [{ id: "tile-next", text: `+${stats.next} at ${next}` }] : []),
  ];
}

function Notes({ stats, next }: { stats: TileStats; next: string | null }) {
  const notes = noteList(stats, next).map((n) => <span key={n.id} data-testid={n.id}>{n.text}</span>);
  if (notes.length === 0) return null;
  return <span className="more">{notes.flatMap((n, i) => (i ? [<span key={`s${i}`}>{NOTE_GAP}</span>, n] : [n]))}</span>;
}

const FULL: TagFit = { show: "full", dx: 0, dy: 0 };

function countryFits(world: HexWorld, byId: Map<string, VocabMapRegion>, plan: LabelPlan, view: BandView, camera: Camera, viewport: Size) {
  return fitTags(world.countries.filter((c) => plan.countries.has(c.regionId) && byId.has(c.regionId)).map((c) => {
    const stats = tileStats(regionWords(byId.get(c.regionId)!), view.shown, view.next);
    return {
      id: c.regionId,
      name: byId.get(c.regionId)!.name,
      count: `${stats.known} / ${stats.total}`,
      notes: noteList(stats, view.next).map((n) => n.text).join(NOTE_GAP),
      places: c.labelSpots.map((p) => ({ x: (p.x - camera.x) * camera.k + viewport.width / 2, y: (p.y - camera.y) * camera.k + viewport.height / 2 })),
      weight: c.areas.reduce((n, a) => n + a.slots.length, 0),
    };
  }));
}

export function MapTags({ world, regions, plan, view, camera, viewport, compact, pointed }: {
  world: HexWorld;
  regions: VocabMapRegion[];
  plan: LabelPlan;
  view: BandView;
  camera: Camera;
  viewport: Size;
  compact: boolean;
  pointed: string | null;
}) {
  const byId = new Map(regions.map((r) => [r.id, r]));
  const fits = compact ? countryFits(world, byId, plan, view, camera, viewport) : null;
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      {world.countries.map((c) => {
        const region = byId.get(c.regionId);
        if (!region) return null;
        if (plan.countries.has(c.regionId)) {
          const fit = fits?.get(c.regionId) ?? FULL;
          return fit.show !== "hidden" && <Tag key={c.regionId} id={c.regionId} kind="country" name={region.name} words={regionWords(region)}
            view={view} where={c.labelAt} compact={compact} more={pointed === c.regionId} fit={fit} />;
        }
        return c.areas.map((a) => {
          const area = region.areas.find((x) => x.id === a.areaId);
          return area && plan.areas.has(a.areaId) && (
            <Tag key={a.areaId} id={a.areaId} kind="area" name={area.name} words={area.words} view={view} where={a.labelAt} compact={false} more />
          );
        });
      })}
    </div>
  );
}

export function BeyondTheCore({ count, world }: { count: number; world: HexWorld }) {
  const router = useRouter();
  const href = "/vocabulary?status=known";
  const top = world.beyond.y < world.height / 2;
  const left = world.beyond.x < world.width / 2;
  const style = { ...at(world.beyond), transform: `translate(${left ? "0" : "-100%"}, -50%)`, justifyItems: left ? "start" : "end" };
  return (
    <a
      href={href}
      data-testid="beyond-core"
      aria-label={`Beyond the core: ${count.toLocaleString()} words`}
      className={`map-tag text-muted italic hover:underline ${top ? "mt-14" : "-mt-14"}`}
      style={style}
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
