"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { LinkButton } from "@/components/ui";
import { signupHref } from "@/lib/landing";
import { SCENES, advance, frameAt, sceneStart } from "@/lib/showreel";
import { AgainScene, PayoffScene, ReviewScene, TapScene, WatchScene } from "./showreel-scenes";
import { SectionHeading } from "./features";

// The landing page showreel (landing-showreel.feature): plays the product's loop by itself — watch, tap a word,
// review it, meet it again, understand more — while it is on screen. The timeline is lib/showreel.ts.

const DRAW: Record<string, ComponentType<{ p: number }>> = {
  watch: WatchScene,
  tap: TapScene,
  review: ReviewScene,
  again: AgainScene,
  payoff: PayoffScene,
};

const NARRATION: Record<string, string> = {
  watch: "Import a YouTube video, a story or an article. Its subtitles become text you can read and click.",
  tap: "Tap any word you don't know: the meaning appears on the spot, and the word is saved with its sentence.",
  review: "With Pro, a two-minute review brings each word back just before you'd forget it.",
  again: "Next time you meet the word in a video or article, you simply know it. Your known-word count climbs.",
  payoff: "Every page adds words you know, so every text gets easier. A few weeks in, you're reading, not decoding.",
};

function subscribeMedia(onChange: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}
const pageVisible = () => document.visibilityState === "visible";

/** Whether the element is (at least partly) on screen. */
function useInView(ref: React.RefObject<HTMLElement | null>) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.15 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return inView;
}

/** Advances the timeline once per animation frame while `running`. */
function useTimeline(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last: number | null = null;
    const tick = (now: number) => {
      const step = last === null ? 0 : now - last;
      last = now;
      setElapsed((e) => advance(e, step));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running]);
  return [elapsed, setElapsed] as const;
}

export function Showreel() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(subscribeMedia, prefersReducedMotion, () => false);
  const visible = useSyncExternalStore(subscribeVisibility, pageVisible, () => true);
  const inView = useInView(ref);
  const [choice, setChoice] = useState<boolean | null>(null);
  const playing = choice ?? !reduced;
  const running = playing && inView && visible;
  const [elapsed, setElapsed] = useTimeline(running);
  const { scene, progress } = frameAt(elapsed);
  const current = SCENES[scene];
  const Draw = DRAW[current.id];

  return (
    <section id="watch" className="scroll-mt-20 mx-auto w-full max-w-6xl px-4 py-16 md:py-20">
      <SectionHeading eyebrow="See it in action" title="Watch a word go from new to known.">
        Thirty seconds of what a few weeks with us looks like.
      </SectionHeading>
      <div
        ref={ref}
        role="region"
        aria-label="See it in action: an animated walk-through"
        data-testid="showreel"
        data-scene={current.id}
        data-running={String(running)}
        data-progress={progress.toFixed(3)}
        className="mt-10 grid gap-6 lg:grid-cols-[17rem_1fr] lg:gap-10 [&>*]:min-w-0"
      >
        <div className="flex flex-col gap-4">
          <ol aria-label="Scenes" className="grid grid-cols-5 gap-1.5 lg:grid-cols-1 lg:gap-1">
            {SCENES.map((s, i) => (
              <li key={s.id}>
                <button
                  onClick={() => setElapsed(sceneStart(i))}
                  aria-current={i === scene ? "step" : undefined}
                  className={`group w-full rounded-lg text-left transition lg:px-3 lg:py-2.5 ${i === scene ? "lg:bg-card lg:shadow-sm" : "hover:lg:bg-card/60"}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`hidden size-6 shrink-0 place-items-center rounded-full text-xs font-semibold lg:grid ${i === scene ? "bg-rubric text-accent-ink" : "bg-line text-muted"}`}>{i + 1}</span>
                    <span className={`sr-only text-sm lg:not-sr-only ${i === scene ? "font-semibold text-ink" : "text-muted group-hover:text-ink"}`}>{s.caption}</span>
                  </span>
                  <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line lg:mt-2">
                    <span className="block h-full rounded-full bg-rubric" style={{ width: `${i < scene ? 100 : i === scene ? progress * 100 : 0}%` }} />
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="hidden text-muted lg:block">{NARRATION[current.id]}</p>
          <button
            onClick={() => setChoice(!playing)}
            className="self-start rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-muted transition hover:border-accent hover:text-ink"
          >
            {playing ? <><span aria-hidden>❚❚</span> Pause</> : <><span aria-hidden>▶</span> Play</>}
          </button>
        </div>

        <div>
          <div className="rounded-2xl border border-line bg-card shadow-[0_24px_60px_-28px_rgb(0_0_0/0.35)]">
            <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
              <span className="font-display text-lg font-semibold text-rubric tabular-nums">{scene + 1}</span>
              <p className="font-medium" aria-live="polite" data-testid="showreel-caption">{current.caption}</p>
            </div>
            <div className="pointer-events-none min-h-[23rem] overflow-hidden p-5 select-none md:p-6" aria-hidden="true" data-testid="showreel-stage">
              <div key={current.id} className="showreel-in">
                <Draw p={reduced && !playing ? 1 : progress} />
              </div>
            </div>
          </div>
          <p className="mt-3 text-sm text-muted lg:hidden">{NARRATION[current.id]}</p>
          <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-accent-soft p-4 transition-opacity duration-500 ${current.id === "payoff" ? "opacity-100" : "invisible opacity-0"}`}>
            <p className="max-w-md text-sm">
              Reading gets comfortable once you know about <strong>98%</strong> of the words on the page (Hu &amp; Nation,
              2000). We get you there one page at a time.
            </p>
            <LinkButton href={signupHref()}>Start reading free</LinkButton>
          </div>
        </div>
      </div>
    </section>
  );
}
