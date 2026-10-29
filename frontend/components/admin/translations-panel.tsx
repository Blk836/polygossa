"use client";

import { useEffect, useState, type ReactNode } from "react";
import { BarChart } from "@/components/charts";
import { ErrorNote, Spinner } from "@/components/ui";
import { cents, dollars, LOOKUP_LAYERS, pairName, percent, share, type AdminTranslations, type TranslationRow } from "@/lib/admin";
import { api, errorMessage } from "@/lib/api";

const PERIODS = [7, 30, 90] as const;

const count = (n: number) => n.toLocaleString("en-US");

export function Period({ days, onDays }: { days: number; onDays: (d: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Period" className="inline-flex rounded-lg border border-line bg-paper p-1 text-sm">
      {PERIODS.map((d) => (
        <button
          key={d}
          type="button"
          role="radio"
          aria-checked={days === d}
          onClick={() => onDays(d)}
          className={`rounded-md px-4 py-1.5 transition ${days === d ? "bg-card font-medium text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}
        >
          {d} days
        </button>
      ))}
    </div>
  );
}

export function Table({ label, title, hint, head, rows }: { label: string; title: string; hint?: string; head: string[]; rows: ReactNode }) {
  return (
    <section aria-label={label} className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-right text-sm tabular-nums">
          <thead className="text-xs text-muted">
            <tr>{head.map((h, i) => <th key={h} className={`py-1 pr-3 font-normal ${i === 0 ? "text-left" : ""}`}>{h}</th>)}</tr>
          </thead>
          <tbody>{rows}</tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ row, cells }: { row: TranslationRow; cells: ReactNode[] }) {
  const total = row.source === null;
  return (
    <tr className={`border-t border-line ${total ? "font-semibold" : ""}`}>
      <th scope="row" className="py-2 pr-3 text-left font-medium">{pairName(row.source, row.target)}</th>
      {cells.map((c, i) => <td key={i} className="pr-3">{c}</td>)}
    </tr>
  );
}

function Report({ report }: { report: AdminTranslations }) {
  const rows = [...report.pairs, report.total];
  return (
    <>
      {report.total.lookups === 0 && <p className="rounded-xl border border-line bg-card p-5 text-sm text-muted">No lookups were counted in this period.</p>}

      <Table
        label="Lookups per language pair" title="Lookups" hint="Hit rate: the share answered without a new paid call (stored AI, community)."
        head={["Pair", "Lookups", "Hit rate", ...LOOKUP_LAYERS.map((l) => l.label)]}
        rows={rows.map((r) => (
          <Row key={pairName(r.source, r.target)} row={r} cells={[count(r.lookups), percent(r.hitRate), ...LOOKUP_LAYERS.map((l) => share(r.layers[l.key], r.lookups))]} />
        ))}
      />

      <Table
        label="Calls and cost per language pair" title="Calls and cost"
        hint={`Estimated at $${report.prices.aiInputPerMillionTokens} per million tokens in and $${report.prices.aiOutputPerMillionTokens} out.`}
        head={["Pair", "AI calls", "Tokens in", "Tokens out", "Failures", "Cost", "Per 1,000 lookups"]}
        rows={rows.map((r) => (
          <Row key={pairName(r.source, r.target)} row={r} cells={[
            count(r.aiCalls), count(r.aiTokensIn), count(r.aiTokensOut), count(r.aiFailures), dollars(r.cost), dollars(r.costPer1000Lookups),
          ]} />
        ))}
      />

      <Table
        label="Stored so far" title="Stored so far" hint="Everything stored, including what was stored before counting began."
        head={["Pair", "AI meanings", "Words with a community meaning"]}
        rows={rows.map((r) => (
          <Row key={pairName(r.source, r.target)} row={r} cells={[count(r.stored.sentenceMeanings), count(r.stored.communityWords)]} />
        ))}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {LOOKUP_LAYERS.map((l) => (
          <BarChart key={l.key} title={l.chart} unit="lookups" points={report.trend.map((d) => ({ label: d.day, value: d.layers[l.key] }))} />
        ))}
      </div>
      <BarChart title="Estimated cost (US cents)" unit="cents" points={report.trend.map((d) => ({ label: d.day, value: cents(d.cost) }))} />
    </>
  );
}

export function TranslationsPanel() {
  const [days, setDays] = useState<number>(30);
  const [report, setReport] = useState<AdminTranslations | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<AdminTranslations>(`admin/translations?days=${days}`)
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
    </div>
  );
}
