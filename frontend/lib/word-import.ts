import { languageName } from "./languages";

export interface WordImportJob {
  id: number;
  source: "lingq" | "readlang";
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

export const POLL_MS = 2000;

const SOURCES: Record<WordImportJob["source"], string> = { lingq: "LingQ", readlang: "Readlang" };
const STATES: Record<WordImportJob["state"], string> = { queued: "Importing…", running: "Importing…", done: "Done", failed: "Failed" };

export function isActive(job: WordImportJob): boolean {
  return job.state === "queued" || job.state === "running";
}

export function anyActive(jobs: WordImportJob[]): boolean {
  return jobs.some(isActive);
}

export interface ImportChoice {
  open: boolean;
  source: WordImportJob["source"];
  language: string;
}

export function visibleImports(jobs: WordImportJob[], { open, source, language }: ImportChoice): WordImportJob[] {
  return jobs.filter((job) => isActive(job) || (open && job.source === source && job.language === (language || null)));
}

export function importHeadline(job: WordImportJob): string {
  const language = job.language ? languageName(job.language) : "All languages";
  return `${SOURCES[job.source]} · ${language} · ${STATES[job.state]}`;
}

export function importCounts(job: WordImportJob): string {
  if (isActive(job) && job.found === 0) return `Fetching your words from ${SOURCES[job.source]}…`;
  const parts = [`${job.found} found`, `${job.added} added`, `${job.updated} updated`, `${job.unchanged} unchanged`];
  if (job.overLimit > 0) parts.push(`${job.overLimit} over the Free plan's limit`);
  return parts.join(" · ");
}

export type ImportPhase = "idle" | "starting" | "busy";

export function importButtonLabel(source: WordImportJob["source"], phase: ImportPhase): string {
  if (phase === "starting") return "Starting…";
  if (phase === "busy") return "Importing…";
  return `Import from ${SOURCES[source]}`;
}
