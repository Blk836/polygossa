"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { reachedMilestone, saveSeenMilestones, seenMilestones, streakNews } from "@/lib/milestones";
import { CloseIcon } from "./icons";
import { Polly } from "./polly";
import { Button } from "./ui";

const TOAST_MS = 6000;

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

export function MilestoneDialog({ words, onClose }: { words: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="polly-pop m-auto w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-7 text-center text-ink backdrop:bg-ink/40"
    >
      <Polly mood="proud" className="mx-auto size-28" />
      <h2 id={title} className="mt-2 font-display text-3xl font-semibold tracking-tight">{words.toLocaleString("en-US")} words known</h2>
      <p className="mt-2 text-muted">That&apos;s a full jar. Keep reading to fill the next one.</p>
      <Button autoFocus className="mt-5" onClick={onClose}>Keep reading</Button>
    </dialog>
  );
}

export function useStreakNews(current: number, activeToday: boolean): [{ title: string; body: string } | null, () => void] {
  const [wasActive, setWasActive] = useState(activeToday);
  const [news, setNews] = useState<{ title: string; body: string } | null>(null);
  if (activeToday !== wasActive) {
    setWasActive(activeToday);
    if (activeToday) setNews(streakNews(current));
  }
  useEffect(() => {
    if (!news) return;
    const id = setTimeout(() => setNews(null), TOAST_MS);
    return () => clearTimeout(id);
  }, [news]);
  return [news, () => setNews(null)];
}

export function StreakToast({ news, onClose }: { news: { title: string; body: string }; onClose: () => void }) {
  return createPortal(
    <div role="status" className="polly-pop fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-lg md:bottom-6">
      <Polly mood="cheering" className="size-14 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="font-display text-lg font-semibold">{news.title}</p>
        <p className="text-sm text-muted">{news.body}</p>
      </div>
      <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 text-muted hover:bg-paper">
        <CloseIcon className="size-4" />
      </button>
    </div>,
    document.body,
  );
}
