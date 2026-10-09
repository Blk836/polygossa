"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { IslandMap } from "@/components/progress/island-map";
import { WordPanel } from "@/components/progress/vocab-map-word";
import { ErrorNote, Spinner, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import {
  bandView,
  defaultTopBand,
  mapWords,
  placeOf,
  placeParam,
  storedTopBand,
  tileStats,
  withStatus,
  type MapPlace,
} from "@/lib/vocab-map";
import type { LanguageCode, VocabMap, WordStatus } from "@/lib/types";

const BAND_KEY = "lector_map_band";

function readStoredBand(): string | null {
  try {
    return window.localStorage.getItem(BAND_KEY);
  } catch {
    return null;
  }
}

function storeBand(band: string) {
  try {
    window.localStorage.setItem(BAND_KEY, band);
  } catch {
    // Private windows and blocked storage just don't remember the choice.
  }
}

function Frame({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <section aria-label="Vocabulary map" data-testid="vocab-map" className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Vocabulary map</h2>
        {header}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** The vocabulary map on Progress (vocabulary-map.feature). Key it by language so a switch starts afresh. */
export function VocabMapCard({ language }: { language: LanguageCode | null }) {
  if (!language) {
    return <Frame><p className="text-muted">Pick the language you&apos;re learning in the top bar to see your vocabulary map.</p></Frame>;
  }
  return (
    <Suspense fallback={<Frame><Spinner /></Frame>}>
      <LoadedMap language={language} />
    </Suspense>
  );
}

function LoadedMap({ language }: { language: LanguageCode }) {
  const [state, setState] = useState<{ map: VocabMap; top: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<VocabMap>(`vocab-map?language=${language}`)
      .then((map) => {
        if (cancelled) return;
        setState({ map, top: storedTopBand(readStoredBand(), map.bands) ?? defaultTopBand(map.readingLevel, map.bands) });
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [language]);

  if (error) return <Frame><ErrorNote message={error} /></Frame>;
  if (!state) return <Frame><Spinner /></Frame>;
  if (!state.map.available || !state.top) {
    return <Frame><p className="text-muted">The vocabulary map is coming soon for {languageName(language)}.</p></Frame>;
  }
  return (
    <MapView
      map={state.map}
      top={state.top}
      language={language}
      onTop={(top) => {
        storeBand(top);
        setState({ ...state, top });
      }}
      onStatus={(term, status) => setState({ ...state, map: withStatus(state.map, term, status) })}
    />
  );
}

function MapView({ map, top, language, onTop, onStatus }: {
  map: VocabMap;
  top: string;
  language: LanguageCode;
  onTop: (top: string) => void;
  onStatus: (term: string, status: WordStatus) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const place = placeOf(params.get("map"), map);
  const [selected, setSelected] = useState<string | null>(null);
  const view = useMemo(() => bandView(top, map.bands), [top, map.bands]);
  const overall = tileStats(mapWords(map), view.shown, view.next);
  const word = selectedWord(place, selected);

  const go = (regionId: string | null, areaId: string | null = null) => {
    const param = placeParam(regionId, areaId);
    setSelected(null);
    if (param === params.get("map")) return;
    router.push(param ? `${pathname}?map=${param}` : pathname, { scroll: false });
  };

  const header = (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span data-testid="map-overall" className="font-medium tabular-nums">
        {overall.known.toLocaleString()} / {overall.total.toLocaleString()} core words
      </span>
      <select aria-label="Bands counted" className={selectClass} value={top} onChange={(e) => onTop(e.target.value)}>
        {map.bands.map((b) => <option key={b} value={b}>Up to {b}</option>)}
      </select>
    </div>
  );

  return (
    <Frame header={header}>
      <Breadcrumb region={place.region} area={place.area} go={go} />
      {overall.known + overall.learning === 0 && !place.region && (
        <p className="mb-3 text-sm text-muted">Words you learn while reading fill in the map.</p>
      )}
      {view.soon && !place.area && <p className="mb-3 text-xs text-muted">{view.soon} words coming soon.</p>}
      <IslandMap map={map} view={view} place={place} selected={selected} go={go} onSelect={setSelected} />
      {word && <WordPanel key={word.term} language={language} word={word} onSaved={onStatus} />}
    </Frame>
  );
}

function selectedWord(place: MapPlace, term: string | null) {
  return place.area?.words.find((w) => w.term === term) ?? null;
}

type Go = (regionId: string | null, areaId?: string | null) => void;

const crumbClass = "text-accent hover:underline";

/** "Map › Food & Drink › Fruit & vegetables": every level above the current one is a way back out. */
function Breadcrumb({ region, area, go }: MapPlace & { go: Go }) {
  return (
    <nav aria-label="Map location" className="mb-3 flex flex-wrap items-center gap-1 text-sm" data-testid="map-breadcrumb">
      {region ? <button type="button" className={crumbClass} onClick={() => go(null)}>Map</button> : <span>Map</span>}
      {region && <span aria-hidden className="text-muted">›</span>}
      {region && area && <button type="button" className={crumbClass} onClick={() => go(region.id)}>{region.name}</button>}
      {region && !area && <span>{region.name}</span>}
      {area && <span aria-hidden className="text-muted">›</span>}
      {area && <span>{area.name}</span>}
    </nav>
  );
}
