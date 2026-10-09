import Link from "next/link";
import { KnownBar } from "@/components/ui";
import { areaWords, coverage, regionWords, tileStats, type BandView } from "@/lib/vocab-map";
import type { VocabMapArea, VocabMapRegion, VocabMapWord } from "@/lib/types";

const gridClass = "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4";

/** A region or area: shaded by how much of it is known, with "known / total" and the next band's count. */
function Tile({ name, words, view, onOpen }: { name: string; words: VocabMapWord[]; view: BandView; onOpen: () => void }) {
  const stats = tileStats(words, view.shown, view.next);
  const percent = coverage(stats);
  return (
    <button
      type="button"
      onClick={onOpen}
      data-testid="map-tile"
      aria-label={`${name}: ${stats.known} of ${stats.total} known`}
      className="flex min-h-24 flex-col justify-between gap-2 rounded-lg border border-line p-3 text-left transition hover:border-accent"
      style={{ background: `color-mix(in oklab, var(--w-known) ${percent}%, var(--card))` }}
    >
      <span className="font-medium leading-tight">{name}</span>
      <span>
        <span className="block text-lg font-semibold tabular-nums" data-testid="tile-count">
          {stats.known} / {stats.total}
        </span>
        <span className="flex flex-wrap gap-x-2 text-xs text-muted">
          {stats.learning > 0 && <span data-testid="tile-learning">{stats.learning} learning</span>}
          {view.next && stats.next > 0 && <span data-testid="tile-next">+{stats.next} at {view.next}</span>}
        </span>
        <span className="mt-1 block"><KnownBar known={stats.known} learning={stats.learning} total={stats.total} /></span>
      </span>
    </button>
  );
}

export function RegionTiles({ regions, view, beyondCore, onOpen }: {
  regions: VocabMapRegion[];
  view: BandView;
  beyondCore: number;
  onOpen: (region: VocabMapRegion) => void;
}) {
  return (
    <div className={gridClass}>
      {regions.map((r) => <Tile key={r.id} name={r.name} words={regionWords(r)} view={view} onOpen={() => onOpen(r)} />)}
      <Link
        href="/vocabulary?status=known"
        data-testid="beyond-core"
        className="flex min-h-24 flex-col justify-between gap-2 rounded-lg border border-dashed border-line p-3 hover:border-accent"
      >
        <span className="font-medium leading-tight">Beyond the core</span>
        <span className="text-sm text-muted">
          <span className="block text-lg font-semibold tabular-nums text-ink">{beyondCore.toLocaleString()}</span>
          known words outside the map
        </span>
      </Link>
    </div>
  );
}

export function AreaTiles({ region, view, onOpen }: { region: VocabMapRegion; view: BandView; onOpen: (area: VocabMapArea) => void }) {
  return (
    <div className={gridClass}>
      {region.areas.map((a) => <Tile key={a.id} name={a.name} words={a.words} view={view} onOpen={() => onOpen(a)} />)}
    </div>
  );
}

const statusClass: Record<string, string> = {
  known: "bg-known",
  learning: "bg-learning",
  ignored: "bg-card text-muted line-through",
};

/** An area's words: known green, learning yellow, new plain; the next band's words faint after the rest. */
export function WordTiles({ area, view, selected, onSelect }: {
  area: VocabMapArea;
  view: BandView;
  selected: string | null;
  onSelect: (word: VocabMapWord) => void;
}) {
  return (
    <ul className="flex flex-wrap gap-2" aria-label={`${area.name} words`}>
      {areaWords(area, view.shown, view.next).map(({ word, faint }) => (
        <li key={word.term}>
          <button
            type="button"
            onClick={() => onSelect(word)}
            data-testid="map-word"
            data-status={word.status ?? "new"}
            aria-pressed={selected === word.term}
            className={`min-h-11 rounded-lg border px-3 py-2 text-base ${statusClass[word.status ?? ""] ?? "bg-card"} ${
              faint ? "border-dashed border-line opacity-60" : "border-line"
            } ${selected === word.term ? "ring-2 ring-accent" : ""}`}
          >
            {word.term}
          </button>
        </li>
      ))}
    </ul>
  );
}
