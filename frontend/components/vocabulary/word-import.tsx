"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ErrorNote, Field, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import { POLL_MS, anyActive, importCounts, importHeadline, type WordImportJob } from "@/lib/word-import";

type Source = "lingq" | "readlang";

/**
 * Importing words from LingQ (API key) or Readlang (exported word list). Imports run on the server; this shows the
 * last few and refreshes them every couple of seconds while one is going, calling {@code onImported} when it ends.
 */
export function WordImports({ open, defaultLanguage, onImported }: { open: boolean; defaultLanguage: string; onImported: () => void }) {
  const [jobs, setJobs] = useState<WordImportJob[]>([]);
  const [reload, setReload] = useState(0);
  const wasActive = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api<WordImportJob[]>("word-imports")
        .then((list) => {
          if (cancelled) return;
          setJobs(list);
          if (wasActive.current && !anyActive(list)) onImported();
          wasActive.current = anyActive(list);
        })
        .catch(() => {});
    void load();
    const timer = setInterval(() => wasActive.current && void load(), POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [reload, onImported]);

  if (!open && jobs.length === 0) return null;
  return (
    <section aria-label="Import words" className="mb-4 space-y-3">
      {open && <ImportForm defaultLanguage={defaultLanguage} busy={anyActive(jobs)} onStarted={() => setReload((r) => r + 1)} />}
      {jobs.length > 0 && <ImportList jobs={jobs} />}
    </section>
  );
}

function ImportForm({ defaultLanguage, busy, onStarted }: { defaultLanguage: string; busy: boolean; onStarted: () => void }) {
  const [source, setSource] = useState<Source>("lingq");
  const [language, setLanguage] = useState(defaultLanguage);
  const [apiKey, setApiKey] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (source === "lingq") {
        await api("word-imports/lingq", { body: { apiKey: apiKey.trim(), language: language || null } });
        setApiKey("");
      } else {
        const form = new FormData();
        if (file) form.append("file", file);
        form.append("language", language);
        await api("word-imports/readlang", { body: form });
      }
      onStarted();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-card p-5">
      <div className="flex gap-1 rounded-lg border border-line bg-paper p-1 text-sm sm:w-fit" role="group" aria-label="Import from">
        {(["lingq", "readlang"] as const).map((s) => (
          <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)}
            className={`flex-1 rounded-md px-4 py-1.5 ${source === s ? "bg-card font-medium" : "text-muted"}`}>
            {s === "lingq" ? "LingQ" : "Readlang"}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {source === "lingq" ? (
          <Field label="LingQ API key" hint={<>Copy it from <a className="underline" href="https://www.lingq.com/accounts/apikey/" target="_blank" rel="noreferrer">lingq.com/accounts/apikey</a>. It&apos;s used for this import only and never stored.</>}>
            <input className={inputClass} type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
          </Field>
        ) : (
          <Field label="Readlang word list" hint="On Readlang, open your words and export them (CSV or tab-separated), then upload that file.">
            <input className={inputClass} type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
          </Field>
        )}
        <Field label="Language">
          <select className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value)} required={source === "readlang"}>
            {source === "lingq" ? <option value="">All languages</option> : <option value="">Choose…</option>}
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </Field>
      </div>
      <ErrorNote message={error} />
      <Button type="submit" disabled={busy}>{source === "lingq" ? "Import from LingQ" : "Import from Readlang"}</Button>
      {busy && <p className="text-sm text-muted">An import is running: you can leave this page, it keeps going.</p>}
    </form>
  );
}

function ImportList({ jobs }: { jobs: WordImportJob[] }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line bg-card text-sm">
      {jobs.map((job) => (
        <li key={job.id} data-testid="word-import" className="p-3">
          <p className="font-medium">{importHeadline(job)}</p>
          <p className="text-muted">{importCounts(job)}</p>
          {job.error && <p className="text-bad">{job.error}</p>}
          {job.overLimit > 0 && <Link href="/settings/subscription" className="underline">See plans</Link>}
        </li>
      ))}
    </ul>
  );
}
