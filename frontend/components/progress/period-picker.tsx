import { selectClass } from "@/components/ui";
import { STATS_PERIODS, type StatsPeriodKey } from "@/lib/progress";

export function PeriodPicker({ value, onChange }: { value: StatsPeriodKey; onChange: (period: StatsPeriodKey) => void }) {
  return (
    <select className={`${selectClass} w-auto`} value={value} onChange={(e) => onChange(e.target.value as StatsPeriodKey)} aria-label="Period">
      {STATS_PERIODS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
    </select>
  );
}
