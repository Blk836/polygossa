"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useMe } from "@/components/me-context";
import { GoalFields, type GoalChoice } from "@/components/settings/goal-fields";
import { InterestsSection } from "@/components/settings/interests-section";
import { ProfilePhoto } from "@/components/settings/profile-photo";
import { Button, ErrorNote, Field, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { NATIVE_LANGUAGES } from "@/lib/dictionary";
import { LANGUAGES } from "@/lib/languages";
import { settingsHashRedirect } from "@/lib/nav";
import type { Me } from "@/lib/types";

/** Settings' Profile tab: photo, name, languages, daily goal and time zone. */
export default function ProfilePage() {
  const { me, setMe } = useMe();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(me.displayName);
  const [targetLanguage, setTargetLanguage] = useState(me.targetLanguage ?? "");
  const [nativeLanguage, setNativeLanguage] = useState(me.nativeLanguage ?? "en");
  const [goal, setGoal] = useState<GoalChoice>({ ...me.dailyGoal, streakNeedsGoal: me.streakNeedsGoal });
  const [timezone, setTimezone] = useState(me.timezone);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bookmarks to the old single page's sections (/settings#plan) open the tab that now holds them.
  useEffect(() => {
    const moved = settingsHashRedirect(window.location.hash);
    if (moved) router.replace(moved);
  }, [router]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    try {
      setMe(await api<Me>("me", { method: "PATCH", body: { displayName, targetLanguage: targetLanguage || undefined, nativeLanguage, dailyGoal: { kind: goal.kind, target: goal.target }, streakNeedsGoal: goal.streakNeedsGoal, timezone } }));
      setSaved(true);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="space-y-4">
      <ProfilePhoto />
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
          <Field label="Your native language" hint="Definitions are translated into it where the dictionary can">
            <select className={selectClass} value={nativeLanguage} onChange={(e) => setNativeLanguage(e.target.value)}>
              {NATIVE_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.nativeName}</option>)}
            </select>
          </Field>
          <GoalFields value={goal} onChange={setGoal} />
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
      <InterestsSection />
    </div>
  );
}
