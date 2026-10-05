"use client";

import { useState, type FormEvent } from "react";
import { useMe } from "@/components/me-context";
import { ThemePicker } from "@/components/theme-picker";
import { Button, ErrorNote, Field, PageHeader, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import type { Me, Tier } from "@/lib/types";

const PLANS: { tier: Tier; name: string; price: string; items: string[] }[] = [
  { tier: "FREE", name: "Free", price: "$0", items: ["5 imported texts", "500 saved words", "Basic dictionary"] },
  { tier: "PRO", name: "Pro", price: "$8/mo or $60/yr", items: ["Unlimited texts & words", "Spaced repetition review", "Audio sync", "AI definitions, examples & writing tutor"] },
  { tier: "CLASSROOM", name: "Classroom", price: "$4/student/mo", items: ["All Pro features", "Create classes & assign texts", "Student progress", "Pro access for your students"] },
];

export default function SettingsPage() {
  const { me, setMe } = useMe();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [targetLanguage, setTargetLanguage] = useState(me.targetLanguage ?? "");
  const [goal, setGoal] = useState(me.dailyReviewGoal);
  const [timezone, setTimezone] = useState(me.timezone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planBusy, setPlanBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      setMe(await api<Me>("me", { method: "PATCH", body: { displayName, targetLanguage: targetLanguage || undefined, dailyReviewGoal: goal, timezone } }));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function choosePlan(tier: Tier) {
    setPlanBusy(true);
    try {
      setMe(await api<Me>("me/plan", { body: { tier } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPlanBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <form onSubmit={save} className="space-y-4 rounded-xl border border-line bg-card p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} required maxLength={80} /></Field>
          <Field label="Email"><input className={inputClass} value={me.email} disabled /></Field>
          <Field label="Main language you're learning">
            <select className={selectClass} value={targetLanguage} onChange={(e) => setTargetLanguage(e.target.value)}>
              <option value="">—</option>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
            </select>
          </Field>
          <Field label="Daily review goal" hint="Cards per day that count toward your streak">
            <input type="number" min={1} max={500} className={inputClass} value={goal} onChange={(e) => setGoal(Number(e.target.value))} />
          </Field>
          <Field label="Time zone" hint="Decides when your day (and streak) rolls over">
            <input className={inputClass} value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </Field>
        </div>
        <ErrorNote message={error} />
        <div className="flex items-center gap-3">
          <Button type="submit">Save</Button>
          <button type="button" className="text-sm text-muted underline" onClick={() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)}>Use this device&apos;s time zone</button>
          {saved && <span className="text-sm text-accent">Saved</span>}
        </div>
      </form>

      <section id="appearance" className="mt-8">
        <h2 className="font-display text-lg font-semibold">Appearance</h2>
        <p className="mt-1 text-sm text-muted">System follows your device&apos;s light or dark setting. Saved on this device.</p>
        <div className="mt-3"><ThemePicker /></div>
      </section>

      <section id="plan" className="mt-8">
        <h2 className="font-display text-lg font-semibold">Plan</h2>
        {me.plan.sponsoredByClassroom && (
          <p className="mt-1 text-sm text-muted">You have Pro features through your teacher&apos;s Classroom plan.</p>
        )}
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {PLANS.map((p) => {
            const current = me.plan.tier === p.tier;
            return (
              <div key={p.tier} className={`flex flex-col rounded-xl border bg-card p-4 ${current ? "border-accent" : "border-line"}`}>
                <p className="font-semibold">{p.name}</p>
                <p className="text-sm text-muted">{p.price}</p>
                <ul className="mt-3 flex-1 space-y-1 text-sm">
                  {p.items.map((i) => <li key={i}>✓ {i}</li>)}
                </ul>
                <Button className="mt-4" variant={current ? "secondary" : "primary"} disabled={current || planBusy} onClick={() => choosePlan(p.tier)}>
                  {current ? "Current plan" : p.tier === "FREE" ? "Downgrade" : `Switch to ${p.name}`}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted">
          Demo billing: plan changes apply immediately. In production this button would open the payment provider&apos;s checkout.
        </p>
        {me.plan.limits.texts !== null && (
          <p className="mt-2 text-sm text-muted">
            Usage: {me.plan.usage.texts}/{me.plan.limits.texts} texts · {me.plan.usage.savedWords}/{me.plan.limits.savedWords} saved words
          </p>
        )}
      </section>
    </div>
  );
}
