"use client";

import { useState } from "react";
import { Bone, ButtonBone, CardFrame, SectionLoading } from "@/components/skeletons/parts";
import { Button, FailureNote } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import type { WritingGrade, WritingTest } from "@/lib/types";
import { scoreBand } from "@/lib/writing";

const CRITERIA: Record<string, string> = {
  task: "Task",
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  coherence: "Coherence",
};

export function GradeView({ test, onChanged, onNew }: {
  test: WritingTest;
  onChanged: (t: WritingTest) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-5">
      <Situation test={test} />
      {test.grade ? <Grade grade={test.grade} test={test} /> : <Ungraded test={test} onChanged={onChanged} />}
      <Button onClick={onNew}>Take another test</Button>
    </div>
  );
}

function Situation({ test }: { test: WritingTest }) {
  return (
    <div className="rounded-xl border border-line bg-card p-5">
      <p className="text-xs font-semibold tracking-wide text-rubric uppercase">Situation · {test.level}</p>
      <p className="mt-2 font-reading leading-relaxed">{test.prompt}</p>
    </div>
  );
}

export function GradingOutline({ test }: { test: WritingTest }) {
  return (
    <div className="space-y-5">
      <Situation test={test} />
      <SectionLoading label="results">
        <div className="space-y-5">
          <CardFrame part="score" className="flex flex-wrap items-center gap-6">
            <div className="flex flex-col items-center gap-2"><Bone className="h-14 w-20" /><Bone className="h-3.5 w-16" /></div>
            <div className="flex-1 space-y-2"><Bone className="h-7 w-32" /><Bone className="h-3.5 w-56" /><Bone className="h-4 w-3/4" /></div>
          </CardFrame>
          <div data-skeleton="rubric" className="grid gap-3 sm:grid-cols-2">
            {Object.keys(CRITERIA).map((c) => (
              <div key={c} className="rounded-xl border border-line bg-card p-4">
                <div className="flex justify-between"><Bone className="h-4 w-24" /><Bone className="h-3.5 w-10" /></div>
                <Bone className="mt-2 h-1.5 w-full rounded-full" />
                <Bone className="mt-2 h-3.5 w-3/4" />
              </div>
            ))}
          </div>
          <div data-skeleton="texts" className="grid gap-3 md:grid-cols-2">
            {[0, 1].map((i) => <CardFrame key={i}><Bone className="h-3.5 w-28" /><div className="mt-3 space-y-2"><Bone className="h-4 w-full" /><Bone className="h-4 w-5/6" /><Bone className="h-4 w-2/3" /></div></CardFrame>)}
          </div>
          <ButtonBone className="w-40" />
        </div>
      </SectionLoading>
    </div>
  );
}

function Grade({ grade, test }: { grade: WritingGrade; test: WritingTest }) {
  const short = (test.wordCount ?? 0) < test.minWords;
  return (
    <>
      <div className="flex flex-wrap items-center gap-6 rounded-xl border border-line bg-card p-5">
        <div className="text-center">
          <p className="font-display text-6xl font-semibold tabular-nums">{grade.score}</p>
          <p className="text-sm text-muted">out of 100</p>
        </div>
        <div className="flex-1">
          <p className="font-display text-2xl font-semibold">{scoreBand(grade.score)}</p>
          {grade.level && <p className="text-sm text-muted">Your writing reads at about {grade.level}.</p>}
          {short && (
            <p className="mt-1 text-sm text-bad">
              {test.wordCount} of {test.minWords} {test.unit}: the score is capped for being short.
            </p>
          )}
          <p className="mt-2">{grade.summary}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {grade.rubric.map((r) => (
          <div key={r.criterion} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-baseline justify-between">
              <p className="font-medium">{CRITERIA[r.criterion] ?? r.criterion}</p>
              <p className="text-sm tabular-nums text-muted">{r.score} / 5</p>
            </div>
            <div className="mt-2 flex gap-1" aria-hidden>
              {[1, 2, 3, 4, 5].map((n) => <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= r.score ? "bg-accent" : "bg-line"}`} />)}
            </div>
            {r.comment && <p className="mt-2 text-sm text-muted">{r.comment}</p>}
          </div>
        ))}
      </div>
      {grade.corrections.length > 0 && (
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-display text-lg font-semibold">Corrections</h2>
          <ul className="mt-3 space-y-3" lang={test.language}>
            {grade.corrections.map((c, i) => (
              <li key={i} className="text-sm">
                <span className="text-bad line-through">{c.original}</span> → <span className="font-medium text-good">{c.corrected}</span>
                <p className="text-muted" lang="en">{c.explanation}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <TextBlock title="What you wrote" text={test.content ?? ""} language={test.language} />
        <TextBlock title="Corrected" text={grade.correctedText} language={test.language} />
      </div>
    </>
  );
}

function TextBlock({ title, text, language }: { title: string; text: string; language: string }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <p className="mt-2 font-reading whitespace-pre-wrap" lang={language}>{text}</p>
    </section>
  );
}

function Ungraded({ test, onChanged }: { test: WritingTest; onChanged: (t: WritingTest) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  async function retry() {
    setBusy(true);
    setError(null);
    try {
      onChanged(await api<WritingTest>(`writing/tests/${test.id}/grade`, { method: "POST" }));
    } catch (e) {
      setError(e instanceof ApiError ? e : String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl border border-warn/40 bg-warn-soft p-5">
      <p className="font-medium">Your answer is saved but hasn&apos;t been graded yet.</p>
      {test.gradeError && <p className="mt-1 text-sm text-muted">{test.gradeError}</p>}
      <Button className="mt-3" variant="secondary" onClick={() => void retry()} disabled={busy}>{busy ? "Grading…" : "Grade it now"}</Button>
      <FailureNote error={error} />
      <TextBlock title="What you wrote" text={test.content ?? ""} language={test.language} />
    </div>
  );
}
