import { money } from "./transcribe.mjs";

const ORDER = ["imported", "copied", "transcribed", "would import", "would copy", "would transcribe", "already imported", "skipped", "refused", "failed", "invalid", "not run"];
const RETRY = new Set(["skipped", "failed", "not run"]);

export function summary(results) {
  const counts = ORDER.map((outcome) => [outcome, results.filter((r) => r.outcome === outcome).length])
    .filter(([, n]) => n > 0)
    .map(([outcome, n]) => `${n} ${outcome}`);
  const lines = `${results.length} line${results.length === 1 ? "" : "s"}`;
  return counts.length ? `${lines}: ${counts.join(", ")}` : lines;
}

export function transcriptionTotal(results) {
  const priced = results.filter((r) => (r.outcome === "transcribed" || r.outcome === "would transcribe") && r.seconds);
  if (!priced.length) {
    return null;
  }
  const minutes = Math.round(priced.reduce((sum, r) => sum + r.seconds, 0) / 60);
  const cost = priced.reduce((sum, r) => sum + r.costUsd, 0);
  return `Transcription: ${priced.length} video${priced.length === 1 ? "" : "s"}, ${minutes} min, about ${money(cost)}`;
}

export function resultsFile(results) {
  return text(results);
}

export function retryFile(results) {
  return text(results.filter((r) => RETRY.has(r.outcome)));
}

function text(results) {
  return results.map((r) => `${listLine(r.entry)}  # ${note(r)}\n`).join("");
}

function listLine({ url, language, category, error }) {
  return error ? `# ${url}` : [url, language, category].filter(Boolean).join(" ");
}

function note({ outcome, reason, title }) {
  return `${outcome}${reason ? `: ${reason}` : ""}${title ? ` — ${title}` : ""}`;
}
