import type { ReactNode } from "react";
import { countUp, knownPercent, phase, spokenIndex } from "@/lib/showreel";

// The showreel's five scenes (showreel.tsx plays them). Each draws itself from `p`, its progress from 0 to 1, so the
// same frame always looks the same: pausing, jumping and reduced motion (drawn at p = 1) need nothing extra.

type Word = [text: string, status: "new" | "known"];

const SUBTITLE: Word[] = [
  ["Hoy", "known"], ["vamos", "known"], ["a", "known"], ["cocinar", "new"], ["paella", "known"], ["con", "known"],
  ["mariscos", "new"], ["frescos", "new"],
];
const TARGET = 6;

const shown = (visible: boolean) => (visible ? "opacity-100 translate-y-0 scale-100" : "pointer-events-none opacity-0 translate-y-2 scale-95");
const FADE = "transition duration-500 ease-out";

/** One subtitle line; `status` picks each word's colour, `speaking` the word being said, `pointer` sits on the target. */
function Subtitle({ status, speaking, pointer }: { status: (i: number) => string; speaking?: number; pointer?: ReactNode }) {
  return (
    <p lang="es" className="reading text-xl md:text-2xl">
      {SUBTITLE.map(([text], i) => (
        <span key={i}>
          <span
            data-testid={i === TARGET ? "showreel-target" : undefined}
            className={`w relative w-${status(i)} ${speaking === i ? "w-speaking" : ""}`}
          >
            {text}
            {i === TARGET && pointer}
          </span>
          {i < SUBTITLE.length - 1 ? " " : "."}
        </span>
      ))}
    </p>
  );
}

/** A stylised video: a dish that bobs while it plays, a sound meter and the timeline. Shorter once paused. */
function VideoFrame({ p, playing }: { p: number; playing: boolean }) {
  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-xl border border-line ${playing ? "aspect-[16/6]" : "aspect-[16/4]"}`}
      style={{ background: "radial-gradient(circle at 50% 60%, var(--card) 0%, var(--cover-food) 60%)" }}
    >
      <span className={playing ? "showreel-bob text-5xl md:text-6xl" : "text-3xl md:text-5xl"}>🥘</span>
      <span className="absolute left-3 top-3 rounded-md bg-card/85 px-2 py-0.5 text-xs font-medium">Cocina con Marta · 8:14</span>
      <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-card/85 text-[0.6rem]">{playing ? "❚❚" : "▶"}</span>
      <div className="absolute bottom-6 left-3 flex h-5 items-end gap-0.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`w-1 rounded-full bg-rubric ${playing ? "showreel-bar" : "opacity-40"}`} style={{ height: 8 + ((i * 7) % 12), animationDelay: `${i * 120}ms` }} />
        ))}
      </div>
      <div className="absolute inset-x-3 bottom-3 h-1 rounded-full bg-card/60">
        <div className="h-full rounded-full bg-rubric" style={{ width: `${20 + p * 25}%` }} />
      </div>
    </div>
  );
}

export function WatchScene({ p }: { p: number }) {
  const speaking = spokenIndex(p, SUBTITLE.length);
  return (
    <div className="space-y-5">
      <VideoFrame p={p} playing />
      <Subtitle status={(i) => SUBTITLE[i][1]} speaking={speaking} />
      <p className="text-sm text-muted">Every subtitle line is clickable. The word being spoken lights up.</p>
    </div>
  );
}

/** The animated pointer: glides in from the lower right, then taps (a ring pulses out). */
function Pointer({ p }: { p: number }) {
  const move = phase(p, 0, 0.3);
  const tapped = p >= 0.32;
  const ease = 1 - (1 - move) ** 3;
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 z-10" style={{ transform: `translate(${(1 - ease) * 140}px, ${(1 - ease) * 90}px)` }}>
      {tapped && <span className="showreel-tap absolute -left-3 -top-3 size-6 rounded-full border-2 border-rubric" />}
      <svg width="22" height="26" viewBox="0 0 22 26" className={`drop-shadow ${tapped && p < 0.4 ? "scale-90" : ""} transition`}>
        <path d="M2 2 L2 21 L7 16.5 L10.5 24 L14 22.5 L10.5 15 L17 15 Z" fill="var(--ink)" stroke="var(--card)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function TapScene({ p }: { p: number }) {
  const tapped = p >= 0.32;
  return (
    <div className="space-y-4">
      <VideoFrame p={0.95} playing={false} />
      <Subtitle status={(i) => (i === TARGET && tapped ? "learning" : SUBTITLE[i][1])} pointer={<Pointer p={p} />} />
      <div className={`${FADE} ${shown(p >= 0.38)} rounded-xl border border-line bg-paper p-4 shadow-sm`} data-testid="showreel-card">
        <p className="flex items-baseline gap-2">
          <span lang="es" className="font-reading text-xl font-semibold">mariscos</span>
          <span className="text-sm text-muted">noun · plural</span>
        </p>
        <p className="mt-0.5">seafood</p>
        <p className={`${FADE} ${shown(p >= 0.62)} mt-2 inline-flex items-center gap-1.5 rounded-full bg-good-soft px-2.5 py-0.5 text-sm font-medium text-good`}>
          ✓ Saved to your words
        </p>
      </div>
    </div>
  );
}

export function ReviewScene({ p }: { p: number }) {
  const flipped = p >= 0.3;
  const chose = p >= 0.6;
  return (
    <div className="mx-auto max-w-sm text-center">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">Review · 12 due · about 2 minutes</p>
      <div className="showreel-card-3d mt-4">
        <div className={`showreel-flip relative h-40 ${flipped ? "showreel-flipped" : ""}`}>
          <div className="showreel-face absolute inset-0 grid place-content-center rounded-2xl border border-line bg-paper p-4">
            <p lang="es" className="font-reading text-3xl font-semibold">mariscos</p>
            <p className="reading mt-2 text-sm italic text-muted">“Hoy vamos a cocinar paella con mariscos frescos.”</p>
          </div>
          <div className="showreel-face showreel-back absolute inset-0 grid place-content-center rounded-2xl border border-line bg-paper p-4">
            <p className="font-reading text-3xl font-semibold" data-testid="showreel-answer">seafood</p>
            <p lang="es" className="mt-2 text-sm text-muted">mariscos · noun</p>
          </div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-sm">
        <span className="rounded-lg bg-bad-soft py-2 font-medium text-bad">Forgot</span>
        <span className="rounded-lg bg-warn-soft py-2 font-medium text-warn">Hard</span>
        <span className={`rounded-lg bg-good-soft py-2 font-medium text-good transition ${chose ? "ring-2 ring-good scale-105" : ""}`}>Easy</span>
      </div>
      <p className={`${FADE} ${shown(p >= 0.7)} mt-4 text-sm font-medium`}>Next review in 4 days</p>
    </div>
  );
}

export function AgainScene({ p }: { p: number }) {
  const count = countUp(1240, 1284, phase(p, 0.25, 0.85));
  const known = p >= 0.15;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-line bg-paper p-4">
        <p className="text-xs font-medium tracking-wide text-muted uppercase">A week later · new article</p>
        <p lang="es" className="reading mt-2 text-xl md:text-2xl">
          <span className="w w-known">En</span> <span className="w w-known">el</span> <span className="w w-known">mercado</span>{" "}
          <span className="w w-known">venden</span>{" "}
          <span data-testid="showreel-target" className={`w ${known ? "w-known showreel-glow" : "w-learning"}`}>mariscos</span>{" "}
          <span className="w w-known">y</span> <span className="w w-new">pescado</span>.
        </p>
        <p className={`${FADE} ${shown(known)} mt-2 text-sm text-good`}>✓ You know “mariscos” now. No lookup needed.</p>
      </div>
      <div className="flex items-end justify-between gap-4">
        <p>
          <span className="font-display text-5xl font-semibold tabular-nums" data-testid="showreel-count">{count.toLocaleString("en-US")}</span>
          <span className="ml-2 text-muted">known words</span>
        </p>
        <p className={`${FADE} ${shown(p >= 0.5)} rounded-full bg-good-soft px-3 py-1 text-sm font-medium text-good`}>+44 this week</p>
      </div>
    </div>
  );
}

// The payoff paragraph: the same text on day 1 and day 60, with the words still new on each day. The meters show
// exactly the share of this paragraph's words that are known.
const PARAGRAPH = ("El sábado fuimos al mercado del puerto. Los pescadores vendían mariscos frescos y mi abuela regateaba con " +
  "todos. Al final también compramos gambas, pan y un poco de queso para la cena.").split(" ");
const NEW_DAY1 = new Set([1, 6, 8, 9, 10, 15, 21, 22, 28]);
const NEW_DAY60 = new Set([15]);

function Day({ label, newWords, p, testId }: { label: string; newWords: Set<number>; p: number; testId: string }) {
  const percent = knownPercent(PARAGRAPH.length, newWords.size);
  return (
    <figure className="min-w-0 rounded-xl border border-line bg-paper p-3 md:p-4">
      <figcaption className="text-xs font-semibold tracking-wide text-muted uppercase">{label}</figcaption>
      <p lang="es" className="reading mt-2 text-xs leading-relaxed sm:text-sm md:text-base">
        {PARAGRAPH.map((w, i) => (
          <span key={i}><span className={`w ${newWords.has(i) ? "w-new" : "w-known"}`}>{w}</span>{" "}</span>
        ))}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-good" style={{ width: `${countUp(0, percent, p)}%` }} />
        </div>
        <span className="w-10 text-right text-sm font-semibold tabular-nums" data-testid={testId}>{countUp(0, percent, p)}%</span>
      </div>
    </figure>
  );
}

export function PayoffScene({ p }: { p: number }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Day label="Day 1" newWords={NEW_DAY1} p={phase(p, 0.05, 0.35)} testId="showreel-day1" />
        <Day label="Day 60" newWords={NEW_DAY60} p={phase(p, 0.3, 0.6)} testId="showreel-day60" />
      </div>
      <p className="text-xs text-muted">Blue words are new to this learner; the bars show the share they already know. An example.</p>
      <p className={`${FADE} ${shown(p >= 0.65)} text-center font-display text-2xl font-semibold`}>
        Same text. <span className="text-rubric">Two months</span> of reading apart.
      </p>
    </div>
  );
}
