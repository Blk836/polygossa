"use client";

import { useEffect, useState } from "react";
import { useMe } from "@/components/me-context";
import { Bone, RowsBone, SectionLoading } from "@/components/skeletons/parts";
import { Empty, ErrorNote, PageHeader, UpgradeNote } from "@/components/ui";
import { GradeView } from "@/components/writing/grade-view";
import { StartPanel, WritingHistory } from "@/components/writing/start-panel";
import { TestSession } from "@/components/writing/test-session";
import { api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import type { WritingTest } from "@/lib/types";

export default function WritingPage() {
  const { me, isPro } = useMe();
  if (!isPro) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Writing" />
        <UpgradeNote message="Timed writing tests with AI grading are part of Pro." />
      </div>
    );
  }
  if (!me.targetLanguage) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Writing" />
        <Empty title="Choose a language first" prop="pencil">Pick the language you&apos;re learning in the top bar.</Empty>
      </div>
    );
  }
  return <Writing key={me.targetLanguage} language={me.targetLanguage} />;
}

type View = { kind: "start" } | { kind: "test"; test: WritingTest } | { kind: "result"; test: WritingTest };

function Writing({ language }: { language: string }) {
  const [history, setHistory] = useState<WritingTest[] | null>(null);
  const [view, setView] = useState<View>({ kind: "start" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<WritingTest[]>(`writing/tests?language=${language}`)
      .then((list) => {
        if (cancelled) return;
        setHistory(list);
        if (list[0]?.status === "in_progress") setView({ kind: "test", test: list[0] });
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [language]);

  const record = (t: WritingTest) => setHistory((h) => [t, ...(h ?? []).filter((x) => x.id !== t.id)]);
  const finished = (t: WritingTest) => {
    record(t);
    setView({ kind: "result", test: t });
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Writing" subtitle={`Five-minute ${languageName(language)} writing tests, graded at the end.`} />
      <ErrorNote message={error} />
      {view.kind === "test" && <TestSession test={view.test} onDone={finished} />}
      {view.kind === "result" && <GradeView test={view.test} onChanged={finished} onNew={() => setView({ kind: "start" })} />}
      {view.kind === "start" && (
        <>
          <StartPanel language={language} onStarted={(t) => { record(t); setView({ kind: "test", test: t }); }} />
          {history ? <WritingHistory tests={history} onOpen={(t) => setView({ kind: "result", test: t })} /> : !error && <SectionLoading label="past tests" className="mt-8"><Bone className="mb-3 h-6 w-28" /><RowsBone count={3} lead /></SectionLoading>}
        </>
      )}
    </div>
  );
}
