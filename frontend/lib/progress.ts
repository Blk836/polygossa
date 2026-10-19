import type { ActivityDay, GoalKind, GoalToday, Streak } from "./types";

const MILESTONES = [100, 250, 500, 1000, 1500, 2000, 3000, 4000, 5000, 7500, 10_000, 15_000, 20_000, 30_000, 40_000, 50_000];
const STEP_AFTER_TABLE = 10_000;

export const GOAL_UNITS: Record<GoalKind, string> = {
  reviews: "reviews",
  words_read: "words read",
  minutes_read: "minutes read",
  minutes_listened: "minutes listened",
};

export function goalProgress(goal: GoalToday): { text: string; percent: number; met: boolean } {
  const percent = Math.min(100, Math.floor((goal.done / goal.target) * 100));
  return { text: `${goal.done.toLocaleString("en-US")} / ${goal.target.toLocaleString("en-US")} ${GOAL_UNITS[goal.kind]}`, percent, met: goal.met };
}

export function listeningLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export interface Milestone {
  from: number;
  to: number;
  remaining: number;
  fraction: number;
}

export function baseWords(n: number): string {
  return `${n.toLocaleString("en-US")} base ${n === 1 ? "word" : "words"}`;
}

export function milestone(known: number): Milestone {
  const last = MILESTONES[MILESTONES.length - 1];
  let to = MILESTONES.find((m) => m > known);
  if (to === undefined) to = (Math.floor(known / STEP_AFTER_TABLE) + 1) * STEP_AFTER_TABLE;
  const from = to > last ? to - STEP_AFTER_TABLE : [...MILESTONES].reverse().find((m) => m <= known) ?? 0;
  return { from, to, remaining: to - known, fraction: Math.round(((known - from) / (to - from)) * 100) / 100 };
}

export function streakMessage({ current, best, activeToday }: Streak): string {
  if (activeToday) {
    return current > 1 && current >= best
      ? `Day ${current} done — a new personal best!`
      : `Day ${current} done — come back tomorrow to make it ${current + 1}.`;
  }
  if (current > 0) return `Read, review or save a word today to keep your ${current}-day streak.`;
  return best > 0 ? `Start a new streak today — your best is ${best} days.` : "Read for a minute or save a word to start a streak.";
}

export interface WeekChange {
  trend: "up" | "steady";
  text: string;
}

export type StatsPeriodKey = "week" | "month" | "quarter" | "year" | "all";

const LABELS: Record<StatsPeriodKey, string> = {
  week: "Last week",
  month: "Last month",
  quarter: "Last quarter",
  year: "Last year",
  all: "All time",
};

export const STATS_PERIODS = (Object.keys(LABELS) as StatsPeriodKey[]).map((key) => ({ key, label: LABELS[key] }));

export function periodLabel(key: StatsPeriodKey): string {
  return LABELS[key];
}

const BEFORE: Record<Exclude<StatsPeriodKey, "all">, string> = {
  week: "last week",
  month: "the month before",
  quarter: "the quarter before",
  year: "the year before",
};

export function periodChange(now: number, before: number | null, period: StatsPeriodKey, format: (n: number) => string = String): WeekChange {
  if (period === "all" || before === null) return { trend: "steady", text: "Since you joined" };
  const earlier = BEFORE[period];
  if (now > before) {
    const text = before === 0 ? `Up from nothing ${earlier}` : `+${Math.round(((now - before) / before) * 100)}% on ${earlier}`;
    return { trend: "up", text };
  }
  if (now === before) {
    if (now > 0) return { trend: "steady", text: `Same as ${earlier}` };
    return { trend: "steady", text: period === "week" ? "Nothing yet — this week starts today" : "Nothing yet — start today" };
  }
  return { trend: "steady", text: `${format(before)} ${earlier}` };
}

export function weekChange(thisWeek: number, lastWeek: number, format: (n: number) => string = String): WeekChange {
  return periodChange(thisWeek, lastWeek, "week", format);
}

export function intensity(day: ActivityDay): 0 | 1 | 2 | 3 {
  if (!day.active) return 0;
  const minutes = day.readingSeconds / 60;
  const words = day.wordsSaved + day.wordsKnown;
  if (minutes >= 30 || words >= 25) return 3;
  if (minutes >= 15 || words >= 10) return 2;
  return 1;
}

const INITIALS = ["S", "M", "T", "W", "T", "F", "S"];
const weekday = (isoDay: string) => new Date(`${isoDay}T00:00:00Z`).getUTCDay();

export interface StripDay {
  day: string;
  label: string;
  active: boolean;
  today: boolean;
}

export function weekStrip(days: ActivityDay[]): StripDay[] {
  const last = days.slice(-7);
  return last.map((d, i) => ({ day: d.day, label: INITIALS[weekday(d.day)], active: d.active, today: i === last.length - 1 }));
}

export function calendarWeeks(days: ActivityDay[]): (ActivityDay | null)[][] {
  if (days.length === 0) return [];
  const padded: (ActivityDay | null)[] = [...Array<null>((weekday(days[0].day) + 6) % 7).fill(null), ...days];
  const weeks: (ActivityDay | null)[][] = [];
  for (let i = 0; i < padded.length; i += 7) weeks.push(padded.slice(i, i + 7));
  return weeks;
}
