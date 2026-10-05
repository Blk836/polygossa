import { calendarWeeks, intensity } from "@/lib/progress";
import type { ActivityDay } from "@/lib/types";

const LEVELS = ["bg-line", "bg-good/35", "bg-good/65", "bg-good"] as const;
const ROWS = ["Mon", "", "Wed", "", "Fri", "", ""];

function describe(d: ActivityDay): string {
  if (!d.active) return `${d.day}: no practice`;
  const parts = [`${Math.round(d.readingSeconds / 60)} min read`, `${d.wordsSaved + d.wordsKnown} words`];
  if (d.reviews) parts.push(`${d.reviews} reviews`);
  return `${d.day}: ${parts.join(", ")}`;
}

/** Twelve weeks of practice, one square per day (darker = more), Monday at the top. */
export function ActivityCalendar({ days }: { days: ActivityDay[] }) {
  const active = days.filter((d) => d.active).length;
  return (
    <section aria-label="Activity" className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Last 12 weeks</h2>
        <p className="text-sm text-muted" data-testid="active-days">
          {active} {active === 1 ? "day" : "days"} practised
        </p>
      </div>
      <div className="mt-4 flex gap-1 overflow-x-auto" role="img" aria-label={`${active} days practised in the last 12 weeks`}>
        <div className="grid grid-rows-7 gap-1 pr-1 text-[10px] leading-3 text-muted" aria-hidden>
          {ROWS.map((r, i) => <span key={i} className="h-3">{r}</span>)}
        </div>
        {calendarWeeks(days).map((week, w) => (
          <div key={w} className="grid grid-rows-7 gap-1">
            {week.map((d, i) =>
              d ? (
                <span key={d.day} title={describe(d)} data-level={intensity(d)} className={`size-3 rounded-sm ${LEVELS[intensity(d)]}`} />
              ) : (
                <span key={`pad-${i}`} className="size-3" />
              ),
            )}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-xs text-muted" aria-hidden>
        Less {LEVELS.map((c) => <span key={c} className={`size-3 rounded-sm ${c}`} />)} More
      </div>
    </section>
  );
}
