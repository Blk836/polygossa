"use client";

import { useState } from "react";
import { LineChart } from "@/components/charts";
import { useMe } from "@/components/me-context";
import { ActivityCalendar } from "@/components/progress/activity-calendar";
import { MilestoneCard } from "@/components/progress/milestone-card";
import { StreakCard } from "@/components/progress/streak-card";
import { PeriodCard } from "@/components/progress/period-card";
import { PeriodPicker } from "@/components/progress/period-picker";
import { useDashboard } from "@/components/progress/use-dashboard";
import { Empty, ErrorNote, PageHeader, Spinner, formatDuration } from "@/components/ui";
import { languageName } from "@/lib/languages";
import { periodLabel, type StatsPeriodKey } from "@/lib/progress";
import type { Dashboard, LanguageCode } from "@/lib/types";

/** Known words and the growth curve for the language picked in the top bar (else the first with any progress). */
function languageFigures(data: Dashboard, picked: LanguageCode | null) {
  const language = picked ?? data.languages[0]?.language ?? null;
  return {
    language,
    known: data.languages.find((l) => l.language === language)?.known ?? 0,
    growth: data.growth.find((g) => g.language === language),
  };
}

// The Progress page exists to keep learners coming back: the daily streak leads, then how close the next known-word
// milestone is and how the chosen period (last week by default) compares, with the long view (calendar, growth curve)
// underneath.
export default function DashboardPage() {
  const { me } = useMe();
  const [period, setPeriod] = useState<StatsPeriodKey>("week");
  const { data, error } = useDashboard(period);

  if (!data) return error ? <ErrorNote message={error} /> : <Spinner />;
  const label = periodLabel(data.period.period); // the figures shown, which lag the picker while loading

  const { language, known, growth } = languageFigures(data, me.targetLanguage);
  const knownEverywhere = data.languages.reduce((s, l) => s + l.known, 0);
  const { activity } = data;

  return (
    <div>
      <PageHeader
        title="Progress"
        subtitle="A little every day adds up."
        actions={<PeriodPicker value={period} onChange={setPeriod} />}
      />
      {error && <div className="mb-4"><ErrorNote message={error} /></div>}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <StreakCard streak={activity.streak} days={activity.days} />
        </div>
        <MilestoneCard known={known} language={language} />
      </div>

      <div className="mt-4">
        <PeriodCard stats={data.period} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ActivityCalendar days={activity.days} />
        {growth ? (
          <LineChart
            title={`Known ${languageName(growth.language)} words — ${label.toLowerCase()}`}
            unit="known words"
            points={growth.known.map((p) => ({ label: p.day, value: p.value }))}
          />
        ) : (
          <Empty title="Your growth curve starts here">Mark words as known (or finish a lesson) and watch this line climb.</Empty>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-muted" data-testid="all-time">
        All time: {formatDuration(data.totalReadingSeconds)} reading · {knownEverywhere.toLocaleString()} known words
        {data.languages.length > 1 && ` across ${data.languages.length} languages`}
      </p>
    </div>
  );
}
