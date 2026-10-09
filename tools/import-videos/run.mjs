import { Fatal } from "./client.mjs";

export async function run(entries, { client, delayMs, dryRun, sleep, print }) {
  const results = [];
  let asked = 0;
  for (const entry of entries) {
    if (entry.error || results.fatal) {
      results.push(skip(entry, results.fatal));
    } else {
      if (asked++ > 0 && !dryRun) {
        await sleep(delayMs);
      }
      const result = await importOne(client, entry, dryRun);
      results.fatal = result.fatal;
      delete result.fatal;
      results.push(result);
    }
    print(describe(results.at(-1)));
  }
  return results;
}

function skip(entry, fatal) {
  return entry.error ? { entry, outcome: "invalid", reason: entry.error, title: "" }
    : { entry, outcome: "not run", reason: fatal, title: "" };
}

async function importOne(client, entry, dryRun) {
  try {
    return { entry, ...(await client.importVideo(entry, dryRun)) };
  } catch (error) {
    if (!(error instanceof Fatal)) {
      throw error;
    }
    return { entry, outcome: "not run", reason: error.message, title: "", fatal: error.message };
  }
}

function describe({ entry, outcome, reason, title }) {
  const detail = title ? `${title}${reason ? ` (${reason})` : ""}` : reason;
  return `line ${entry.line}: ${outcome}${detail ? ` — ${detail}` : ""} ${entry.url}`;
}
