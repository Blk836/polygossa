import { CheckIcon, FlameIcon } from "@/components/icons";
import { LinkButton } from "@/components/ui";
import { HOME } from "@/lib/nav";
import { streakMessage, weekStrip } from "@/lib/progress";
import type { ActivityDay, Streak } from "@/lib/types";

/** The daily streak front and centre: the count, what to do next, the last seven days and the best run. */
export function StreakCard({ streak, days }: { streak: Streak; days: ActivityDay[] }) {
  const lit = streak.current > 0;
  return (
    <section aria-label="Daily streak" className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-center gap-4">
        <FlameIcon className={`size-14 shrink-0 ${lit ? "text-rubric" : "text-muted"}`} aria-hidden />
        <div className="min-w-0">
          <p className="font-display text-4xl font-semibold tabular-nums">
            <span data-testid="streak-count">{streak.current}</span>
            <span className="ml-2 text-lg font-normal text-muted">day streak</span>
          </p>
          <p className="mt-1 text-sm" data-testid="streak-message">{streakMessage(streak)}</p>
        </div>
      </div>

      <ol aria-label="Last 7 days" className="mt-5 grid grid-cols-7 gap-2 text-center">
        {weekStrip(days).map((d) => (
          <li key={d.day} className="flex flex-col items-center gap-1" aria-label={`${d.day}: ${d.active ? "practised" : "no practice"}`}>
            <span
              className={`flex size-8 items-center justify-center rounded-full ${d.active ? "bg-rubric text-accent-ink" : "bg-line"} ${d.today ? "ring-2 ring-rubric ring-offset-2 ring-offset-card" : ""}`}
              data-active={d.active}
            >
              {d.active && <CheckIcon className="size-4" aria-hidden />}
            </span>
            <span className={`text-xs ${d.today ? "font-semibold" : "text-muted"}`}>{d.today ? "Today" : d.label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-sm text-muted">
          Best streak: <span className="font-semibold text-ink tabular-nums" data-testid="best-streak">{streak.best}</span>{" "}
          {streak.best === 1 ? "day" : "days"}
        </p>
        {!streak.activeToday && <LinkButton href={HOME}>Continue reading</LinkButton>}
      </div>
    </section>
  );
}
