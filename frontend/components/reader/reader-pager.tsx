"use client";

interface Props {
  page: number;
  count: number;
  onPage: (page: number) => void;
  className?: string;
  /** A line under the controls, e.g. what turning the page will do. */
  note?: string | null;
}

const button = "rounded-lg border border-line bg-card px-3 py-1.5 text-sm hover:bg-paper disabled:cursor-default disabled:opacity-40 disabled:hover:bg-card";

/**
 * Previous / "Page n of N" with a progress bar / Next, under the text. Hidden for a single page. The note line keeps
 * its height when empty, so every page has the same room for text.
 */
export function ReaderPager({ page, count, onPage, className = "", note }: Props) {
  if (count <= 1) return null;
  return (
    <nav aria-label="Pages" data-tour="reader-next" className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
      <button className={button} onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
        ← <span className="hidden sm:inline">Previous</span>
      </button>
      <div className="flex flex-1 flex-col items-center gap-1">
        <span className="text-sm text-muted tabular-nums">Page {page} of {count}</span>
        <div
          role="progressbar"
          aria-label="Reading progress"
          aria-valuemin={1}
          aria-valuemax={count}
          aria-valuenow={page}
          className="h-1 w-full max-w-48 overflow-hidden rounded bg-line"
        >
          <div className="h-full bg-accent" style={{ width: `${(page / count) * 100}%` }} />
        </div>
      </div>
      <button className={button} onClick={() => onPage(page + 1)} disabled={page >= count} aria-label="Next page">
        <span className="hidden sm:inline">Next</span> →
      </button>
      <p className="min-h-4 w-full text-center text-xs text-muted">{note}</p>
    </nav>
  );
}
