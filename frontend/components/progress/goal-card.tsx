import Link from "next/link";
import { goalProgress } from "@/lib/progress";
import type { GoalToday } from "@/lib/types";

export function GoalCard({ goal }: { goal: GoalToday }) {
  const { text, percent, met } = goalProgress(goal);
  return (
    <section aria-label="Today's goal" className="rounded-xl border border-line bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Today&apos;s goal</h2>
        <Link href="/settings" className="text-xs text-muted underline">Change</Link>
      </div>
      <p className="mt-2 text-sm tabular-nums" data-testid="goal-text">{text}</p>
      <div role="progressbar" aria-label="Today's goal" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
        className="mt-2 h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-rubric" style={{ width: `${percent}%` }} />
      </div>
      {met && <p className="mt-2 text-sm font-medium text-good">Goal reached — well done!</p>}
    </section>
  );
}
