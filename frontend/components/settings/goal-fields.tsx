"use client";

import { Field, inputClass, selectClass } from "@/components/ui";
import { GOAL_UNITS } from "@/lib/progress";
import type { GoalKind } from "@/lib/types";

export interface GoalChoice {
  kind: GoalKind;
  target: number;
  streakNeedsGoal: boolean;
}

/** Targets that make sense for each kind of goal when switching to it (the backend checks the limits). */
const DEFAULT_TARGETS: Record<GoalKind, number> = { reviews: 20, words_read: 1000, minutes_read: 15, minutes_listened: 15 };

/** Settings › Profile: what the daily goal measures, its target, and whether only goal days count for the streak. */
export function GoalFields({ value, onChange }: { value: GoalChoice; onChange: (v: GoalChoice) => void }) {
  return (
    <>
      <Field label="Daily goal measures" hint="Progress shows how much of it you've done today">
        <select className={selectClass} value={value.kind}
          onChange={(e) => {
            const kind = e.target.value as GoalKind;
            onChange({ ...value, kind, target: DEFAULT_TARGETS[kind] });
          }}>
          {(Object.keys(GOAL_UNITS) as GoalKind[]).map((k) => (
            <option key={k} value={k}>{GOAL_UNITS[k][0].toUpperCase() + GOAL_UNITS[k].slice(1)}</option>
          ))}
        </select>
      </Field>
      <Field label="Daily goal target" hint={value.kind === "reviews" ? "Cards per day (also Review's goal)" : `${GOAL_UNITS[value.kind]} per day`}>
        <input type="number" min={1} className={inputClass} value={value.target} onChange={(e) => onChange({ ...value, target: Number(e.target.value) })} />
      </Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" checked={value.streakNeedsGoal} onChange={(e) => onChange({ ...value, streakNeedsGoal: e.target.checked })} />
        Only count days I reach my daily goal toward my streak
      </label>
    </>
  );
}
