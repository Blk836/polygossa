// Importing words from LingQ or Readlang (/api/word-imports): the job type, mirroring the backend's WordImportDto,
// and how the Words page describes a job.
import { languageName } from "./languages";

export interface WordImportJob {
  id: number;
  source: "lingq" | "readlang";
  /** Null: every language. */
  language: string | null;
  state: "queued" | "running" | "done" | "failed";
  found: number;
  added: number;
  updated: number;
  unchanged: number;
  overLimit: number;
  error: string | null;
  createdAt: string;
  finishedAt: string | null;
}

/** How often the Words page refreshes an import's progress. */
export const POLL_MS = 2000;

const SOURCES: Record<WordImportJob["source"], string> = { lingq: "LingQ", readlang: "Readlang" };
const STATES: Record<WordImportJob["state"], string> = { queued: "Importing…", running: "Importing…", done: "Done", failed: "Failed" };

export function isActive(job: WordImportJob): boolean {
  return job.state === "queued" || job.state === "running";
}

export function anyActive(jobs: WordImportJob[]): boolean {
  return jobs.some(isActive);
}

/** "LingQ · French · Done". */
export function importHeadline(job: WordImportJob): string {
  const language = job.language ? languageName(job.language) : "All languages";
  return `${SOURCES[job.source]} · ${language} · ${STATES[job.state]}`;
}

/**
 * "254 found · 250 added · 3 updated · 1 unchanged", plus any words over the Free plan's limit. Until the first
 * words arrive, a running import says it is fetching them instead of showing a row of zeros.
 */
export function importCounts(job: WordImportJob): string {
  if (isActive(job) && job.found === 0) return `Fetching your words from ${SOURCES[job.source]}…`;
  const parts = [`${job.found} found`, `${job.added} added`, `${job.updated} updated`, `${job.unchanged} unchanged`];
  if (job.overLimit > 0) parts.push(`${job.overLimit} over the Free plan's limit`);
  return parts.join(" · ");
}

/** The Import button: idle, sending the start, or waiting for a running import. */
export type ImportPhase = "idle" | "starting" | "busy";

export function importButtonLabel(source: WordImportJob["source"], phase: ImportPhase): string {
  if (phase === "starting") return "Starting…";
  if (phase === "busy") return "Importing…";
  return `Import from ${SOURCES[source]}`;
}
