"use client";

import { useState } from "react";
import { LineChart } from "@/components/charts";
import { useMe } from "@/components/me-context";
import { ActivityCalendar } from "@/components/progress/activity-calendar";
import { GoalCard } from "@/components/progress/goal-card";
import { MilestoneCard } from "@/components/progress/milestone-card";
import { StreakCard } from "@/components/progress/streak-card";
import { PeriodCard } from "@/components/progress/period-card";
import { PeriodPicker } from "@/components/progress/period-picker";
import { SkillLevelsCard } from "@/components/progress/skill-levels-card";
import { useDashboard } from "@/components/progress/use-dashboard";
import { VocabMapCard } from "@/components/progress/vocab-map";
import { ProgressSkeleton } from "@/components/skeletons/pages";
import { Empty, ErrorNote, PageHeader, formatDuration } from "@/components/ui";
import { languageName } from "@/lib/languages";
import { listeningLabel, periodLabel, type StatsPeriodKey } from "@/lib/progress";
import type { Dashboard, LanguageCode } from "@/lib/types";

function languageFigures(data: Dashboard, picked: LanguageCode | null) {
  const language = picked ?? data.languages[0]?.language ?? null;
  return {
    language,
    known: data.languages.find((l) => l.language === language)?.known ?? 0,
    growth: data.growth.find((g) => g.language === language),
  };
}

export default function DashboardPage() {
  const { me } = useMe();
  const [period, setPeriod] = useState<StatsPeriodKey>("week");
  const { data, error } = useDashboard(period);

  if (!data) return error ? <ErrorNote message={error} /> : <ProgressSkeleton />;
  const label = periodLabel(data.period.period === "today" ? "week" : data.period.period);

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
        <div className="self-start lg:col-span-2" data-tour="streak">
          <StreakCard streak={activity.streak} days={activity.days} />
        </div>
        <div className="grid gap-4">
          <GoalCard goal={data.goal} />
          <div data-tour="known-words"><MilestoneCard known={known} language={language} /></div>
        </div>
      </div>

      {language && (
        <div className="mt-4">
          <SkillLevelsCard key={language} language={language} />
        </div>
      )}

      <div className="mt-4">
        <VocabMapCard key={me.targetLanguage ?? "none"} language={me.targetLanguage} />
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
        All time: {formatDuration(data.totalReadingSeconds)} reading · {data.totalWordsRead.toLocaleString("en-US")} words read ·{" "}
        {listeningLabel(data.totalListenedSeconds)} listening · {knownEverywhere.toLocaleString()} known words
        {data.languages.length > 1 && ` across ${data.languages.length} languages`}
      </p>
    </div>
  );
}
