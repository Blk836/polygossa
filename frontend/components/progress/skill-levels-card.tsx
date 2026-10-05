"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorNote, Spinner, formatDuration } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import { confidenceText, emptyHint, evidenceText, isEstimate, levelText, overallText, SKILLS, SKILL_NAMES } from "@/lib/skill-levels";
import type { LanguageCode, SkillKey, SkillLevels } from "@/lib/types";

/** Reading, Listening and Writing levels in one language. Key it by language so a switch starts afresh. */
export function SkillLevelsCard({ language }: { language: LanguageCode }) {
  const [levels, setLevels] = useState<SkillLevels | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<SkillLevels>(`levels?language=${language}`)
      .then((l) => !cancelled && setLevels(l))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [language]);

  return (
    <section aria-label="Skill levels" className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-semibold">Your {languageName(language)} levels</h2>
        {levels?.overall && (
          <p className="text-sm font-medium" data-testid="overall-level">{overallText(levels.overall)}</p>
        )}
      </div>
      {error ? (
        <div className="mt-3"><ErrorNote message={error} /></div>
      ) : !levels ? (
        <Spinner />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SKILLS.map((key) => <SkillTile key={key} skillKey={key} levels={levels} />)}
        </div>
      )}
    </section>
  );
}

function SkillTile({ skillKey, levels }: { skillKey: SkillKey; levels: SkillLevels }) {
  const skill = levels[skillKey];
  const confidence = confidenceText(skill);
  const evidence = evidenceText(skillKey, levels, formatDuration(levels.listeningSeconds));
  const hint = skill.level ? null : emptyHint(skillKey);
  return (
    <div role="group" aria-label={SKILL_NAMES[skillKey]} className="rounded-lg border border-line p-4">
      <p className="text-sm text-muted">{SKILL_NAMES[skillKey]}</p>
      <p
        data-testid="skill-level"
        className={skill.level ? "mt-1 font-display text-3xl font-semibold" : "mt-1 font-display text-lg font-semibold text-muted"}
      >
        {levelText(skill)}
      </p>
      {confidence && (
        <p className={`mt-1 text-xs ${isEstimate(skill) ? "text-warn" : "text-muted"}`}>{confidence}</p>
      )}
      {evidence && <p className="mt-2 text-sm">{evidence}</p>}
      {hint && (
        <p className="mt-2 text-sm text-muted">
          {hint.text}{" "}
          <Link href={hint.href} className="font-medium text-accent hover:underline">{hint.action}</Link>
        </p>
      )}
    </div>
  );
}
