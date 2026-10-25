"use client";

import { useEffect, useState } from "react";
import { NotWordsPanel } from "@/components/admin/not-words-panel";
import { Period, Table } from "@/components/admin/translations-panel";
import { ErrorNote, Spinner } from "@/components/ui";
import { aiJobName, dollars, type AdminAi, type AiJobRow } from "@/lib/admin";
import { api, errorMessage } from "@/lib/api";

const count = (n: number) => n.toLocaleString("en-US");

function Row({ row }: { row: AiJobRow }) {
  const total = row.job === null;
  return (
    <tr className={`border-t border-line ${total ? "font-semibold" : ""}`}>
      <th scope="row" className="py-2 pr-3 text-left font-medium">{aiJobName(row.job)}</th>
      <td className="pr-3">{total ? "" : row.system ? "System" : "Learner"}</td>
      <td className="pr-3">{count(row.calls)}</td>
      <td className="pr-3">{count(row.failures)}</td>
      <td className="pr-3">{count(row.tokensIn)}</td>
      <td className="pr-3">{count(row.tokensOut)}</td>
      <td className="pr-3">{dollars(row.cost)}</td>
    </tr>
  );
}

function Report({ report }: { report: AdminAi }) {
  const { today, prices } = report;
  return (
    <>
      <p data-testid="ai-ceiling" className="text-sm">
        System jobs: <strong className="tabular-nums">{count(today.systemTokens)} of {count(today.ceiling)} tokens today (UTC)</strong>
        {today.systemTokens >= today.ceiling && <> · System jobs are paused until midnight UTC.</>}
      </p>
      {report.jobs.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-5 text-sm text-muted">No AI calls in this period.</p>
      ) : (
        <Table
          label="AI calls per job" title="Calls and cost per job"
          hint={`Estimated at $${prices.aiInputPerMillionTokens} per million tokens in and $${prices.aiOutputPerMillionTokens} out. A call that timed out counts its whole output cap.`}
          head={["Job", "Kind", "Calls", "Failures", "Tokens in", "Tokens out", "Cost"]}
          rows={[...report.jobs, report.total].map((r) => <Row key={r.job ?? "total"} row={r} />)}
        />
      )}
    </>
  );
}

export function AiPanel() {
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<AdminAi | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<AdminAi>(`admin/ai?days=${days}`)
      .then((r) => {
        if (cancelled) return;
        setReport(r);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [days]);

  return (
    <div className="space-y-4">
      <Period days={days} onDays={setDays} />
      <ErrorNote message={error} />
      {report ? <Report report={report} /> : !error && <Spinner />}
      <NotWordsPanel />
    </div>
  );
}
