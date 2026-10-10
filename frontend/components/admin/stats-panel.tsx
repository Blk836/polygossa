"use client";

import { BarChart, LineChart } from "@/components/charts";
import { languageName } from "@/lib/languages";
import { planCounts, type AdminStats } from "@/lib/admin";

function Tile({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <div className="rounded-lg bg-paper p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString("en-US")}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function StatsPanel({ stats }: { stats: AdminStats }) {
  const { users, content } = stats;
  return (
    <div className="space-y-4">
      <div data-testid="admin-tiles" className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-card p-5 sm:grid-cols-4">
        <Tile label="Users" value={users.total} hint={`${users.newToday} new today · ${users.suspended} suspended`} />
        <Tile label="Active today" value={stats.activeToday} />
        <Tile label="Active this week" value={stats.active7} />
        <Tile label="Active this month" value={stats.active30} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LineChart title="Daily active users" unit="users" points={stats.active.map((d) => ({ label: d.day, value: d.value }))} />
        <BarChart title="Sign-ups" unit="sign-ups" points={stats.signups.map((d) => ({ label: d.day, value: d.value }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section aria-label="Users per plan" className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Users per plan</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {planCounts(users.perPlan).map((p) => (
              <li key={p.label}>
                <div className="flex justify-between"><span>{p.label}</span><span className="tabular-nums">{p.count.toLocaleString("en-US")} · {p.percent}%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line"><div className="h-full bg-rubric" style={{ width: `${p.percent}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
        <section aria-label="Learning languages" className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Learning</h2>
          <ul className="mt-3 space-y-1 text-sm">
            {stats.languages.length === 0 && <li className="text-muted">No languages picked yet</li>}
            {stats.languages.map((l) => (
              <li key={l.language} className="flex justify-between"><span>{languageName(l.language)}</span><span className="tabular-nums">{l.users.toLocaleString("en-US")}</span></li>
            ))}
          </ul>
        </section>
        <section aria-label="Content" className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Content and use</h2>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
            {([
              ["Texts", content.texts], ["Shared texts", content.publicTexts], ["Videos", content.videos],
              ["Playlists", content.playlists], ["Forum threads", content.forumThreads], ["Forum posts", content.forumPosts],
              ["Saved words", content.savedWords], ["Reviews today", content.reviewsToday],
              ["Words read today", content.wordsReadToday], ["AI calls today", content.aiCallsToday],
            ] as const).map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted">{label}</dt>
                <dd className="text-right tabular-nums">{value.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </div>
  );
}
