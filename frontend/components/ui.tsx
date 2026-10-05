import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { ApiError } from "@/lib/api";
import { BRAND } from "@/lib/brand";
import type { CefrLevel } from "@/lib/types";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-[inset_0_-2px_0_rgb(0_0_0/0.22)] hover:brightness-110 active:translate-y-px active:shadow-none",
  secondary: "border border-line bg-card text-ink hover:bg-paper",
  ghost: "text-ink hover:bg-line/60",
  danger: "border border-line bg-card text-danger hover:bg-paper",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

export function Button({ variant = "primary", className = "", ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={`${BASE} ${VARIANTS[variant]} ${className}`} {...props} />;
}

/** The wordmark: the brand name set in the display serif with a rubric full stop. */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-semibold tracking-tight ${className}`}>
      {BRAND}<span className="text-rubric">.</span>
    </span>
  );
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-xl border border-line bg-card ${className}`} {...props} />;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const LEVEL_COLORS: Record<CefrLevel, string> = {
  A1: "bg-good-soft text-good",
  A2: "bg-good-soft text-good",
  B1: "bg-warn-soft text-warn",
  B2: "bg-warn-soft text-warn",
  C1: "bg-bad-soft text-bad",
  C2: "bg-bad-soft text-bad",
};

export function LevelBadge({ level }: { level: CefrLevel }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${LEVEL_COLORS[level]}`} title="Estimated CEFR level">
      {level}
    </span>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`rounded-full border border-line px-2 py-0.5 text-xs text-muted ${className}`}>{children}</span>;
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
      aria-label="Loading"
    />
  );
}

export function ErrorNote({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}

export function UpgradeNote({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-warn/40 bg-warn-soft p-3 text-sm text-ink">
      <p>{message}</p>
      <Link href="/settings#plan" className="mt-1 inline-block font-medium underline">
        See plans
      </Link>
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-ink placeholder:text-muted " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

/** Form and filter dropdowns: rounded like the cards, with the app's chevron (styles in globals.css). */
export const selectClass =
  "w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink transition hover:border-accent/50 " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

/** Small dropdowns inside a card or toolbar (category, word status, playback speed): a rounded pill. */
export const chipSelectClass =
  "rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink transition hover:border-accent/50 " +
  "focus:outline-none focus:ring-2 focus:ring-accent/30";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function KnownBar({ known, learning, total }: { known: number; learning: number; total: number }) {
  if (total === 0) return null;
  const k = (known / total) * 100;
  const l = (learning / total) * 100;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <div style={{ width: `${k}%`, background: "var(--w-known-line)" }} />
      <div style={{ width: `${l}%`, background: "var(--w-learning-line)" }} />
    </div>
  );
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** An API failure: plan-limit errors get the upgrade prompt, everything else a plain error message. */
export function FailureNote({ error }: { error: ApiError | string | null }) {
  if (error instanceof ApiError && error.upgradeRequired) return <UpgradeNote message={error.message} />;
  return <ErrorNote message={error instanceof ApiError ? error.message : error} />;
}

/** Previous / next pagination; hidden when everything fits on one page. */
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      <Button variant="secondary" disabled={page === 0} onClick={() => onPage(page - 1)}>Previous</Button>
      <span className="text-muted">Page {page + 1} of {pages}</span>
      <Button variant="secondary" disabled={page + 1 >= pages} onClick={() => onPage(page + 1)}>Next</Button>
    </div>
  );
}
