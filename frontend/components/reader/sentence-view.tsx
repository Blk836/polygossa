"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import type { Token } from "@/lib/types";
import { ChevronLeftIcon, ChevronRightIcon } from "../icons";
import type { ReaderPage } from "./reader-pages";
import { ReaderPager } from "./reader-pager";
import type { ReaderSettings } from "./reader-settings";

const SWIPE_PX = 50;

type Side = "previous" | "next";

function useDirection(page: number): Side | null {
  const [seen, setSeen] = useState<{ page: number; side: Side | null }>({ page, side: null });
  if (seen.page === page) return seen.side;
  const side: Side = page > seen.page ? "next" : "previous";
  setSeen({ page, side });
  return side;
}

function useSentenceSwipe(onMove: (dir: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null);
  return {
    onPointerDown: (e: PointerEvent) => {
      start.current = e.pointerType === "mouse" ? null : { x: e.clientX, y: e.clientY };
    },
    onPointerUp: (e: PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s) return;
      const dx = e.clientX - s.x;
      if (Math.abs(dx) >= SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - s.y)) onMove(dx < 0 ? 1 : -1);
    },
    onPointerCancel: () => {
      start.current = null;
    },
  };
}

function Neighbour({ side, page, paragraph, onMove }: {
  side: Side;
  page: ReaderPage | undefined;
  paragraph: (p: Token[], key: number) => ReactNode;
  onMove: () => void;
}) {
  if (!page) return null;
  return (
    <div
      data-sentence={side}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("[data-i]")) onMove();
      }}
      className="sentence-side min-h-0 w-full max-w-3xl shrink-0 cursor-pointer overflow-hidden rounded-xl px-4 py-2 text-center text-[0.8em] opacity-45 transition-opacity hover:opacity-70 [&_p]:mb-0 [&_p]:line-clamp-1 [@media(min-height:56rem)]:[&_p]:line-clamp-2"
    >
      {page.map(paragraph)}
    </div>
  );
}

export function SentenceStage({ pages, page, height, paragraph, onMove, below }: {
  pages: ReaderPage[];
  page: number;
  height: number | null;
  paragraph: (p: Token[], key: number) => ReactNode;
  onMove: (dir: 1 | -1) => void;
  below: ReactNode;
}) {
  const side = useDirection(page);
  const swipe = useSentenceSwipe(onMove);
  return (
    <div
      data-sentence-stage=""
      {...swipe}
      style={height ? { height } : undefined}
      className="flex min-h-64 touch-pan-y flex-col items-center justify-center gap-5 py-4"
    >
      <Neighbour side="previous" page={pages[page - 2]} paragraph={paragraph} onMove={() => onMove(-1)} />
      <div
        key={`current-${page}`}
        data-sentence="current"
        className={`min-h-0 w-full max-w-3xl shrink overflow-y-auto px-2 text-center text-[1.3em] leading-relaxed [&_p]:mb-0 ${side ? `sentence-in-${side}` : ""}`}
      >
        {(pages[page - 1] ?? []).map(paragraph)}
      </div>
      {below}
      <Neighbour side="next" page={pages[page]} paragraph={paragraph} onMove={() => onMove(1)} />
    </div>
  );
}

const button = "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40";

export function SentenceBar({ page, count, onPage, note, children }: {
  page: number;
  count: number;
  onPage: (n: number) => void;
  note: string | null;
  children: ReactNode;
}) {
  return (
    <nav aria-label="Sentences" className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
      <button className={`${button} border-line bg-card text-muted hover:border-accent/40 hover:text-ink`} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous sentence" title="Previous sentence (←)">
        <ChevronLeftIcon className="size-4" /> <span className="hidden sm:inline">Previous</span>
      </button>
      <div className="flex flex-1 flex-col items-center gap-1.5">
        <span className="text-xs tracking-wide text-muted tabular-nums">{page} / {count}</span>
        <div role="progressbar" aria-label="Reading progress" aria-valuemin={1} aria-valuemax={count} aria-valuenow={page} className="h-1 w-full max-w-56 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(page / Math.max(1, count)) * 100}%` }} />
        </div>
      </div>
      <button className={`${button} border-accent bg-accent font-medium text-accent-ink shadow-sm hover:opacity-90`} onClick={() => onPage(page + 1)} disabled={page >= count} aria-label="Next sentence" title="Next sentence (→)">
        <span className="hidden sm:inline">Next</span> <ChevronRightIcon className="size-4" />
      </button>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-muted">
        {children}
      </div>
      <p className="min-h-4 w-full text-center text-xs text-muted">{note}</p>
    </nav>
  );
}

export function sentenceMode(settings: Pick<ReaderSettings, "view" | "pauseEach">, bySentence: ReaderPage[], fitted: ReaderPage[] | null) {
  const on = settings.view === "sentences";
  return {
    on,
    reach: on ? 1 : 0,
    pauseEach: on && settings.pauseEach,
    unit: on ? ("sentence" as const) : ("page" as const),
    pages: on ? bySentence : fitted,
  };
}

export function sentenceOf(sentences: Map<number, string>, paragraphs: Token[][]): string {
  const first = paragraphs.flat().find((t) => t.word);
  return (first && sentences.get(first.sentence)) ?? "";
}

export function ArticleBody({ on, paragraphs, paragraph, ...stage }: Parameters<typeof SentenceStage>[0] & { on: boolean; paragraphs: Token[][] }) {
  if (!on) return <>{paragraphs.map(paragraph)}</>;
  return <SentenceStage {...stage} paragraph={paragraph} />;
}

export function ReaderNav({ on, children, ...nav }: Parameters<typeof SentenceBar>[0] & { on: boolean }) {
  if (!on) return <ReaderPager {...nav} className="mt-3" />;
  return <SentenceBar {...nav}>{children}</SentenceBar>;
}
