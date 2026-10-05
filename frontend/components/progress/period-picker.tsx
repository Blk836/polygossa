import { selectClass } from "@/components/ui";
import { STATS_PERIODS, type StatsPeriodKey } from "@/lib/progress";

/** Last week (default), month, quarter, year or all time, for the stats card and the growth curve. */
export function PeriodPicker({ value, onChange }: { value: StatsPeriodKey; onChange: (period: StatsPeriodKey) => void }) {
  return (
    <select className={`${selectClass} w-auto`} value={value} onChange={(e) => onChange(e.target.value as StatsPeriodKey)} aria-label="Period">
      {STATS_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
    </select>
  );
}
