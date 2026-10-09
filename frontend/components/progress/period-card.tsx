import { listeningLabel, periodChange, periodLabel, type WeekChange } from "@/lib/progress";
import type { PeriodStats } from "@/lib/types";

const minutes = (seconds: number) => Math.round(seconds / 60);

function Tile({ label, value, change, testId }: { label: string; value: string; change: WeekChange; testId: string }) {
  return (
    <div className="rounded-lg bg-paper p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums" data-testid={testId}>{value}</p>
      <p className={`text-xs ${change.trend === "up" ? "font-medium text-good" : "text-muted"}`}>
        {change.trend === "up" && <span aria-hidden>↑ </span>}
        {change.text}
      </p>
    </div>
  );
}

export function PeriodCard({ stats }: { stats: PeriodStats }) {
  const { period, days, current, previous } = stats;
  const label = periodLabel(period);
  const mins = minutes(current.readingSeconds);
  return (
    <section aria-label={label} className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{label}</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Tile
          label="Words learned"
          testId="words-learned"
          value={current.wordsKnown.toLocaleString()}
          change={periodChange(current.wordsKnown, previous?.wordsKnown ?? null, period)}
        />
        <Tile
          label="Minutes read"
          testId="minutes-read"
          value={mins.toLocaleString()}
          change={periodChange(mins, previous ? minutes(previous.readingSeconds) : null, period, (n) => `${n} min`)}
        />
        <Tile
          label="Words read"
          testId="words-read"
          value={current.wordsRead.toLocaleString("en-US")}
          change={periodChange(current.wordsRead, previous?.wordsRead ?? null, period)}
        />
        <Tile
          label="Listening"
          testId="listening"
          value={listeningLabel(current.listenedSeconds)}
          change={periodChange(minutes(current.listenedSeconds), previous ? minutes(previous.listenedSeconds) : null, period, (n) => `${n} min`)}
        />
        <Tile
          label="Days practised"
          testId="days-practised"
          value={`${current.activeDays} of ${days.toLocaleString()}`}
          change={periodChange(current.activeDays, previous?.activeDays ?? null, period)}
        />
      </div>
    </section>
  );
}
