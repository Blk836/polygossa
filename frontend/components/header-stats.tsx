"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlameIcon } from "./icons";
import { HoneyJar } from "./polly";
import { PollyFlight, usePollyFlights } from "./polly-flight";
import { MilestoneCard, StreakToast, useMilestone, useStreakNews } from "./polly-moments";
import { useMe } from "./me-context";
import { flame, jarCount, knownWords, type HeaderStats as Stats, type HoneyJar as HoneyJarChoice } from "@/lib/header-stats";

const MIN_SCALE = 0.45;

function flameClass(state: "lit" | "fading" | "out", fuel: number): string {
  if (state === "out") return "text-muted";
  if (state === "fading" && fuel < 0.25) return "text-warn streak-flicker";
  return state === "fading" ? "text-rubric streak-flicker" : "text-rubric";
}

function useKnownCount(server: number, risesOnLanding: boolean) {
  const [hold, setHold] = useState<number | null>(null);
  const [floor, setFloor] = useState<{ value: number; server: number } | null>(null);
  const shown = hold ?? (floor && floor.server === server ? Math.max(server, floor.value) : server);
  const latest = useRef({ shown, server });
  const holding = useRef<number | null>(null);
  const before = useRef<number | null>(null);
  useEffect(() => {
    latest.current = { shown, server };
  }, [shown, server]);
  const mark = useCallback(() => {
    before.current = latest.current.shown;
  }, []);
  const takeOff = useCallback(() => {
    holding.current = latest.current.shown;
    setHold(holding.current);
  }, []);
  const land = useCallback(() => {
    if (holding.current === null) return;
    if (risesOnLanding) setFloor({ value: (before.current ?? holding.current) + 1, server: latest.current.server });
    holding.current = null;
    before.current = null;
    setHold(null);
  }, [risesOnLanding]);
  const on = useMemo(() => ({ mark, takeOff }), [mark, takeOff]);
  return { shown, on, land };
}

function useWobbles(count: number): number {
  const [seen, setSeen] = useState(count);
  const [wobbles, setWobbles] = useState(0);
  if (count !== seen) {
    setSeen(count);
    if (count > seen) setWobbles((w) => w + 1);
  }
  return wobbles;
}

function KnownWords({ stats, language }: { stats: Stats; language: string }) {
  const { me } = useMe();
  const choice: HoneyJarChoice = me.honeyJar ?? "all_forms";
  const jar = useRef<HTMLAnchorElement>(null);
  const count = useKnownCount(jarCount(stats, choice), choice === "all_forms");
  const findJar = useCallback(() => jar.current?.querySelector("[data-testid=honey-jar]") ?? null, []);
  const [flight, endFlight] = usePollyFlights(findJar, count.on);
  const wobbles = useWobbles(count.shown);
  const [milestone, closeMilestone] = useMilestone(language, count.shown);
  const known = knownWords(count.shown, choice);
  const land = () => {
    endFlight();
    count.land();
  };
  return (
    <>
      <Link
        ref={jar}
        href="/vocabulary"
        data-testid="known-words"
        aria-label={known.label}
        title={known.label}
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-semibold tabular-nums hover:bg-card"
      >
        <HoneyJar key={wobbles} wobbles={wobbles} />
        <span>{known.text}</span>{" "}
        <span className="font-normal text-muted">known</span>
      </Link>
      {flight && <PollyFlight key={flight.id} flight={flight} onLand={land} />}
      {milestone !== null && <MilestoneCard words={milestone} onClose={closeMilestone} />}
    </>
  );
}

export function HeaderStats({ stats, language }: { stats: Stats; language: string }) {
  const f = flame(stats);
  const [news, closeNews] = useStreakNews(stats.current, stats.activeToday);
  const scale = f.state === "fading" ? MIN_SCALE + (1 - MIN_SCALE) * f.fuel : 1;
  return (
    <div className="flex items-center gap-1">
      <KnownWords stats={stats} language={language} />
      <Link
        href="/dashboard"
        data-testid="streak-flame"
        data-state={f.state}
        data-fuel={String(f.fuel)}
        aria-label={f.label}
        title={f.label}
        className="flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-sm font-semibold tabular-nums hover:bg-card"
      >
        <span className="relative flex size-5 items-end justify-center" aria-hidden>
          {f.state === "fading" && <FlameIcon className="absolute inset-0 size-5 text-muted opacity-40" />}
          <FlameIcon
            className={`size-5 origin-bottom transition-transform duration-1000 ${flameClass(f.state, f.fuel)}`}
            style={{ transform: `scale(${scale})` }}
            fill={f.state === "out" ? "none" : "currentColor"}
            fillOpacity={0.25}
          />
        </span>
        {stats.current}
      </Link>
      {news && <StreakToast news={news} onClose={closeNews} />}
    </div>
  );
}
