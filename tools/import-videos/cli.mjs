// Command-line wiring: arguments and environment in, files and an exit code out. The work is in the other modules.

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Fatal, makeClient } from "./client.mjs";
import { parseList } from "./list.mjs";
import { resultsFile, retryFile, summary } from "./report.mjs";
import { run } from "./run.mjs";

export const USAGE = `Usage: node tools/import-videos.mjs <list-file> [options]

Imports YouTube videos into the community library (public, owned by the library account).
Each line of the list: <YouTube URL> [language] [category]; "#" starts a comment.

Options:
  --language <code>  language for lines that don't give one
  --dry-run          check the list (and what's already imported) without importing
  --delay <seconds>  pause between videos (default 2)
  --backend <url>    backend address (default $BACKEND_URL or http://localhost:8080)
  --token <secret>   curator token (default $CURATOR_TOKEN; must match the backend's)

Writes <list>.results.txt (every line with its outcome) and <list>.retry.txt (lines worth running again).`;

const OPTIONS = {
  language: { type: "string" },
  "dry-run": { type: "boolean", default: false },
  delay: { type: "string", default: "2" },
  backend: { type: "string" },
  token: { type: "string" },
};

/** Runs the tool; returns the exit code (0 when the run finished, even if some videos failed). */
export async function main(argv, { env, print, sleep, fetch = globalThis.fetch }) {
  const settings = settingsFrom(argv, env);
  if (typeof settings === "string") {
    print(settings);
    return 1;
  }
  try {
    return await importList(settings, { print, sleep, fetch });
  } catch (error) {
    if (error instanceof Fatal) {
      print(`Stopped: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

/** The run's settings, or a message saying what's wrong with the arguments. */
function settingsFrom(argv, env) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: true });
  } catch (error) {
    return `${error.message}\n\n${USAGE}`;
  }
  const { values, positionals } = parsed;
  const delay = Number(values.delay);
  if (positionals.length !== 1 || !(delay >= 0)) {
    return USAGE;
  }
  const token = values.token ?? env.CURATOR_TOKEN;
  if (!token) {
    return "Stopped: no curator token: set CURATOR_TOKEN or pass --token (the same value the backend runs with)";
  }
  return { file: positionals[0], token, delayMs: delay * 1000, dryRun: values["dry-run"], language: values.language,
    baseUrl: values.backend ?? env.BACKEND_URL ?? "http://localhost:8080" };
}

async function importList(settings, { print, sleep, fetch }) {
  const text = read(settings.file);
  const client = makeClient({ baseUrl: settings.baseUrl, token: settings.token, fetch });
  const options = await client.options();
  const entries = parseList(text, { ...options, defaultLanguage: settings.language?.toLowerCase() ?? null });
  const results = await run(entries, { client, delayMs: settings.delayMs, dryRun: settings.dryRun, sleep, print });
  print(summary(results));
  if (!settings.dryRun) {
    save(settings.file, results, print);
  }
  if (results.fatal) {
    print(`Stopped: ${results.fatal}`);
    return 1;
  }
  return 0;
}

function read(file) {
  try {
    return readFileSync(file, "utf8");
  } catch {
    throw new Fatal(`can't read ${file}`);
  }
}

function save(file, results, print) {
  const base = file.replace(/\.[^./\\]*$/, "");
  writeFileSync(`${base}.results.txt`, resultsFile(results));
  print(`Results: ${base}.results.txt`);
  const retry = retryFile(results);
  if (retry) {
    writeFileSync(`${base}.retry.txt`, retry);
    print(`To retry: node tools/import-videos.mjs ${base}.retry.txt`);
  } else {
    rmSync(`${base}.retry.txt`, { force: true });
  }
}
