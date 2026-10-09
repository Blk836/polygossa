"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "../icons";

interface Props {
  page: number;
  count: number;
  onPage: (page: number) => void;
  className?: string;
  note?: string | null;
}

const button = "flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors disabled:pointer-events-none disabled:opacity-40";
const quiet = `${button} border-line bg-card text-muted hover:border-accent/40 hover:text-ink`;
const primary = `${button} border-accent bg-accent font-medium text-accent-ink shadow-sm hover:opacity-90`;

export function ReaderPager({ page, count, onPage, className = "", note }: Props) {
  if (count <= 1) return null;
  return (
    <nav aria-label="Pages" data-tour="reader-next" className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <button className={quiet} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeftIcon className="size-4" /> <span className="hidden sm:inline">Previous</span>
      </button>
      <div className="flex flex-1 flex-col items-center gap-1.5">
        <span className="text-xs tracking-wide text-muted tabular-nums">Page {page} of {count}</span>
        <div
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={1}
          aria-valuemax={count}
          aria-valuenow={page}
          className="h-1 w-full max-w-56 overflow-hidden rounded-full bg-line"
        >
          <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(page / count) * 100}%` }} />
        </div>
      </div>
      <button className={primary} data-primary="true" onClick={() => onPage(page + 1)} disabled={page >= count} aria-label="Next page">
        <span className="hidden sm:inline">Next</span> <ChevronRightIcon className="size-4" />
      </button>
      <p className="min-h-4 w-full text-center text-xs text-muted">{note}</p>
    </nav>
  );
}

export function PageArrows({ page, count, onPage }: { page: number; count: number; onPage: (page: number) => void }) {
  if (count <= 1) return null;
  return (
    <>
      {page > 1 && <PageArrow side="previous" onClick={() => onPage(page - 1)} />}
      {page < count && <PageArrow side="next" onClick={() => onPage(page + 1)} />}
    </>
  );
}

function PageArrow({ side, onClick }: { side: "previous" | "next"; onClick: () => void }) {
  const next = side === "next";
  return (
    <button
      type="button"
      tabIndex={-1}
      aria-hidden
      data-page-arrow={side}
      title={next ? "Next page (→)" : "Previous page (←)"}
      onClick={onClick}
      className={`group absolute inset-y-0 ${next ? "-right-14" : "-left-14"} hidden w-12 cursor-pointer items-center justify-center rounded-2xl transition-colors hover:bg-card/70 xl:flex`}
    >
      <span className="flex size-10 items-center justify-center rounded-full border border-line bg-card text-muted shadow-sm transition group-hover:scale-105 group-hover:border-accent/50 group-hover:text-accent">
        {next ? <ChevronRightIcon className="size-5" /> : <ChevronLeftIcon className="size-5" />}
      </span>
    </button>
  );
}
