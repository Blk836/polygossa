"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { reachedMilestone, saveSeenMilestones, seenMilestones, streakNews } from "@/lib/milestones";
import { CloseIcon } from "./icons";
import { Polly } from "./polly";
import { Button } from "./ui";

const TOAST_MS = 6000;
const LEAVE_FALLBACK_MS = 1000;

export function useMilestone(language: string, count: number): [number | null, () => void] {
  const [before, setBefore] = useState(count);
  const [shown, setShown] = useState<number | null>(null);
  const [seen, setSeen] = useState<number[] | null>(null);
  if (count !== before) {
    setBefore(count);
    if (count > before) {
      const reached = reachedMilestone(before, count, seenMilestones(language));
      setSeen(reached.seen);
      if (reached.show !== null) setShown(reached.show);
    }
  }
  useEffect(() => {
    if (seen) saveSeenMilestones(language, seen);
  }, [language, seen]);
  return [shown, () => setShown(null)];
}

export function MilestoneCard({ words, onClose }: { words: number; onClose: () => void }) {
  const title = useId();
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const escape = (e: KeyboardEvent) => e.key === "Escape" && close.current();
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  return createPortal(
    <section
      role="status"
      aria-labelledby={title}
      data-testid="milestone"
      className="polly-pop fixed inset-x-4 bottom-24 z-50 mx-auto max-w-sm rounded-2xl md:inset-x-auto md:bottom-6 md:right-6 md:w-96 border border-line bg-card p-6 text-center text-ink shadow-xl"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-2 text-muted hover:bg-paper">
        <CloseIcon className="size-4" />
      </button>
      <Polly mood="proud" className="mx-auto size-24" />
      <h2 id={title} className="mt-2 font-display text-3xl font-semibold tracking-tight">{words.toLocaleString("en-US")} words known</h2>
      <p className="mt-2 text-muted">That&apos;s a full jar. Keep reading to fill the next one.</p>
      <Button className="mt-4" onClick={onClose}>Keep reading</Button>
    </section>,
    document.body,
  );
}

export function useStreakNews(current: number, activeToday: boolean): [{ title: string; body: string } | null, () => void] {
  const [wasActive, setWasActive] = useState(activeToday);
  const [news, setNews] = useState<{ title: string; body: string } | null>(null);
  if (activeToday !== wasActive) {
    setWasActive(activeToday);
    if (activeToday) setNews(streakNews(current));
  }
  return [news, () => setNews(null)];
}

function useLeaving(onClose: () => void) {
  const [leaving, setLeaving] = useState(false);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused || leaving) return;
    const id = setTimeout(() => setLeaving(true), TOAST_MS);
    return () => clearTimeout(id);
  }, [paused, leaving]);
  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(onClose, LEAVE_FALLBACK_MS);
    return () => clearTimeout(id);
  }, [leaving, onClose]);
  return { leaving, leave: () => setLeaving(true), pause: () => setPaused(true), resume: () => setPaused(false) };
}

export function StreakToast({ news, onClose }: { news: { title: string; body: string }; onClose: () => void }) {
  const { leaving, leave, pause, resume } = useLeaving(onClose);
  return createPortal(
    <div
      role="status"
      data-leaving={leaving || undefined}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onAnimationEnd={(e) => e.animationName.startsWith("streak-leave") && onClose()}
      className={`${leaving ? "streak-leave pointer-events-none" : "polly-pop"} fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-lg md:bottom-6`}
    >
      <span data-testid="streak-polly" className={`shrink-0 ${leaving ? "polly-buzz-off" : ""}`}>
        <Polly mood="cheering" className="size-14" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold">{news.title}</p>
        <p className="text-sm text-muted">{news.body}</p>
      </div>
      <button type="button" aria-label="Close" onClick={leave} className="rounded-lg p-2 text-muted hover:bg-paper">
        <CloseIcon className="size-4" />
      </button>
    </div>,
    document.body,
  );
}
