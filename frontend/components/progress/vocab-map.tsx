"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { HexMap } from "@/components/progress/hex-map";
import { WordPanel } from "@/components/progress/vocab-map-word";
import { ErrorNote, Spinner } from "@/components/ui";
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

/** The card: its title and figures, then the map edge to edge (or a message, padded). */
function Frame({ children, header, notes, bleed = false }: {
  children: React.ReactNode;
  header?: React.ReactNode;
  notes?: React.ReactNode;
  bleed?: boolean;
}) {
  return (
    <section aria-label="Vocabulary map" data-testid="vocab-map" className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="px-5 pb-3 pt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-lg font-semibold">Vocabulary map</h2>
          {header}
        </div>
        {notes}
      </div>
      <div className={bleed ? "" : "px-5 pb-5"}>{children}</div>
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
    <span data-testid="map-overall" className="text-sm tabular-nums text-muted">
      <b className="font-semibold text-ink">{overall.known.toLocaleString()}</b> of {overall.total.toLocaleString()} core words known
    </span>
  );
  const notes = (
    <>
      {overall.known + overall.learning === 0 && <p className="mt-1 text-sm text-muted">Words you learn while reading fill in the map.</p>}
      {view.soon && <p className="mt-1 text-xs text-muted">{view.soon} words coming soon.</p>}
    </>
  );

  return (
    <Frame header={header} notes={notes} bleed>
      <HexMap
        map={map}
        view={view}
        top={top}
        onTop={onTop}
        place={place}
        selected={selected}
        go={go}
        onSelect={setSelected}
        panel={word && <WordPanel key={word.term} language={language} word={word} onSaved={onStatus} onClose={() => setSelected(null)} />}
      />
    </Frame>
  );
}

function selectedWord(place: MapPlace, term: string | null) {
  return place.area?.words.find((w) => w.term === term) ?? null;
}
