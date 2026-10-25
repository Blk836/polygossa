"use client";

import { useState } from "react";
import { Button, ErrorNote, inputClass, selectClass } from "@/components/ui";
import { dollars, type NotWordsPlan, type NotWordsReport } from "@/lib/admin";
import { api, errorMessage } from "@/lib/api";
import { LEARNING_LANGUAGES } from "@/lib/languages";

const count = (n: number) => n.toLocaleString("en-US");

const STOPPED: Record<NotWordsReport["stopped"], string> = {
  done: "Every word has a verdict.",
  calls: "Stopped at the call limit.",
  cap: "Stopped before going over the token cap.",
  ceiling: "Stopped: today's ceiling for system jobs is reached.",
  off: "Stopped: AI isn't configured on this server.",
  failed: "Stopped: an AI call failed. Its words are left for next time.",
};

function PlanNote({ plan }: { plan: NotWordsPlan }) {
  return (
    <p data-testid="not-words-plan" className="text-sm">
      {count(plan.words)} words without a verdict, in {count(plan.texts)} texts: {count(plan.calls)} AI calls, up
      to {count(plan.estimatedTokens)} tokens, at most {dollars(plan.estimatedCost)}.
    </p>
  );
}

function ReportNote({ report }: { report: NotWordsReport }) {
  return (
    <div data-testid="not-words-report" className="space-y-1 text-sm">
      <p>
        {count(report.calls)} calls, {count(report.tokensIn + report.tokensOut)} tokens, {dollars(report.cost)}.{" "}
        {STOPPED[report.stopped]} {count(report.wordsLeft)} words still to check.
      </p>
      <p>
        {count(report.textsUpdated)} texts updated · {count(report.wordsIgnored)} known words moved to Ignored
      </p>
      {report.notWords.length > 0 && (
        <p>
          Not words: <span data-testid="not-words-found">{report.notWords.join(", ")}</span>
        </p>
      )}
    </div>
  );
}

export function NotWordsPanel() {
  const [language, setLanguage] = useState("fr");
  const [maxCalls, setMaxCalls] = useState(3);
  const [maxTokens, setMaxTokens] = useState(100_000);
  const [plan, setPlan] = useState<NotWordsPlan | null>(null);
  const [report, setReport] = useState<NotWordsReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go(run: boolean) {
    setBusy(true);
    setError(null);
    try {
      if (run) setReport(await api<NotWordsReport>("admin/not-words", { body: { language, maxCalls, maxTokens } }));
      setPlan(await api<NotWordsPlan>(`admin/not-words?language=${language}`));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="Not-words cleanup" className="space-y-3 rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Clean up words that aren&apos;t words</h2>
      <p className="text-sm text-muted">
        Checks the words of texts and known words already in the app with AI, marks misspelt and foreign words in
        texts, and moves known ones without a note or tags to Ignored. Start with a dry run.
      </p>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Language
          <select className={selectClass} value={language} onChange={(e) => { setLanguage(e.target.value); setPlan(null); setReport(null); }}>
            {LEARNING_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </label>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => go(false)}>Dry run</Button>
        <label className="flex flex-col gap-1">
          AI calls at most
          <input className={inputClass} type="number" min={1} max={40} value={maxCalls} onChange={(e) => setMaxCalls(Number(e.target.value))} />
        </label>
        <label className="flex flex-col gap-1">
          Tokens at most
          <input className={inputClass} type="number" min={0} step={1000} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} />
        </label>
        <Button type="button" disabled={busy || plan === null} onClick={() => go(true)}>Run</Button>
      </div>
      <ErrorNote message={error} />
      {plan && <PlanNote plan={plan} />}
      {report && <ReportNote report={report} />}
    </section>
  );
}
