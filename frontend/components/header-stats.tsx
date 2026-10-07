"use client";

import Link from "next/link";
import { FlameIcon } from "./icons";
import { flame, knownWords, type HeaderStats as Stats } from "@/lib/header-stats";

/** The smallest the flame shrinks to before it goes out, as a share of its full size. */
const MIN_SCALE = 0.45;

function flameClass(state: "lit" | "fading" | "out", fuel: number): string {
  if (state === "out") return "text-muted";
  if (state === "fading" && fuel < 0.25) return "text-warn streak-flicker";
  return state === "fading" ? "text-rubric streak-flicker" : "text-rubric";
}

/** Known words (LingQ-style, "1,234 known") and the streak flame, which burns down inside its own outline towards midnight while the
 * streak is at risk. */
export function HeaderStats({ stats }: { stats: Stats }) {
  const f = flame(stats);
  const known = knownWords(stats.knownWords);
  const scale = f.state === "fading" ? MIN_SCALE + (1 - MIN_SCALE) * f.fuel : 1;
  return (
    <div className="flex items-center gap-1">
      <Link
        href="/vocabulary"
        data-testid="known-words"
        aria-label={known.label}
        title={known.label}
        className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-sm font-semibold tabular-nums hover:bg-card"
      >
        <span>{known.text}</span>{" "}
        <span className="font-normal text-muted">known</span>
      </Link>
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
    </div>
  );
}
