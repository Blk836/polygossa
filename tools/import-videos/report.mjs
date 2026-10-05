// The end-of-run summary and the two files written next to the list: every result, and the lines worth retrying.

const ORDER = ["imported", "would import", "already imported", "skipped", "refused", "failed", "invalid", "not run"];
const RETRY = new Set(["skipped", "failed", "not run"]);

export function summary(results) {
  const counts = ORDER.map((outcome) => [outcome, results.filter((r) => r.outcome === outcome).length])
    .filter(([, n]) => n > 0)
    .map(([outcome, n]) => `${n} ${outcome}`);
  const lines = `${results.length} line${results.length === 1 ? "" : "s"}`;
  return counts.length ? `${lines}: ${counts.join(", ")}` : lines;
}

/** Every line again, with its outcome as a comment; the file can be fed back to the tool as a list. */
export function resultsFile(results) {
  return text(results);
}

/** The lines that didn't import but might next time; empty when there are none. */
export function retryFile(results) {
  return text(results.filter((r) => RETRY.has(r.outcome)));
}

function text(results) {
  return results.map((r) => `${listLine(r.entry)}  # ${note(r)}\n`).join("");
}

function listLine({ url, language, category, error }) {
  // An invalid line is kept as a comment, so feeding the file back doesn't trip over it again.
  return error ? `# ${url}` : [url, language, category].filter(Boolean).join(" ");
}

function note({ outcome, reason, title }) {
  return `${outcome}${reason ? `: ${reason}` : ""}${title ? ` — ${title}` : ""}`;
}
