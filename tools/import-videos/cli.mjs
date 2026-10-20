import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { makeDownloader } from "./audio.mjs";
import { Fatal, makeClient } from "./client.mjs";
import { makeCopier } from "./copy.mjs";
import { makePlaylist } from "./playlist.mjs";
import { parseList } from "./list.mjs";
import { resultsFile, retryFile, summary, transcriptionTotal } from "./report.mjs";
import { run } from "./run.mjs";
import { makeTranscriber } from "./transcribe.mjs";

export const USAGE = `Usage: node tools/import-videos.mjs <list-file> [options]

Imports YouTube videos into the community library (public, owned by the library account).
Each line of the list: <YouTube URL> [language] [category]; "#" starts a comment.

Options:
  --language <code>  language for lines that don't give one
  --dry-run          check the list (and what's already imported) without importing
  --delay <seconds>  pause between videos (default 2)
  --backend <url>    backend address (default $BACKEND_URL or http://localhost:8080)
  --token <secret>   curator token (default $CURATOR_TOKEN; must match the backend's)

Copy mode: copies videos already imported on another backend, finished, instead of asking YouTube.
  --copy-from <url>      the source backend (any owner's copy there; public and newest first)
  --from-token <secret>  the source's curator token (default $SOURCE_CURATOR_TOKEN)

Transcribe mode: videos without captions in their language get word-timed captions from OpenAI Whisper. yt-dlp
downloads their audio on this PC; the backend (with OPENAI_API_KEY) transcribes it, within its length and cost limits.
  --transcribe                   transcribe videos without captions (--dry-run lists each one's length and cost)
  --cookies-from-browser <name>  the browser whose YouTube sign-in yt-dlp uses (firefox; Chrome's can't be read)
  --cookies <file>               a cookies.txt export to use instead
  --yt-dlp <path>                the yt-dlp program (default yt-dlp)

Playlist mode: puts the list's videos, already in the community library, into a public library playlist in list
order (the same title and language again updates it). Nothing is imported.
  --playlist <title>     the playlist's title
  --description <text>   its description

Writes <list>.results.txt (every line with its outcome) and <list>.retry.txt (lines worth running again).`;

const OPTIONS = {
  language: { type: "string" },
  "dry-run": { type: "boolean", default: false },
  delay: { type: "string", default: "2" },
  backend: { type: "string" },
  token: { type: "string" },
  "copy-from": { type: "string" },
  "from-token": { type: "string" },
  playlist: { type: "string" },
  description: { type: "string" },
  transcribe: { type: "boolean", default: false },
  "cookies-from-browser": { type: "string" },
  cookies: { type: "string" },
  "yt-dlp": { type: "string" },
};

export async function main(argv, { env, print, sleep, fetch = globalThis.fetch, download }) {
  const settings = settingsFrom(argv, env);
  if (typeof settings === "string") {
    print(settings);
    return 1;
  }
  try {
    return await importList(settings, { print, sleep, fetch, download });
  } catch (error) {
    if (error instanceof Fatal) {
      print(`Stopped: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

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
  const mode = modeSettings(values, env);
  if (typeof mode === "string") {
    return mode;
  }
  return { file: positionals[0], token, delayMs: delay * 1000, dryRun: values["dry-run"], language: values.language,
    baseUrl: values.backend ?? env.BACKEND_URL ?? "http://localhost:8080", ...mode };
}

function modeSettings(values, env) {
  if (values.transcribe) {
    const other = ["copy-from", "playlist"].find((name) => values[name] !== undefined);
    return other ? `Stopped: --transcribe doesn't go with --${other}` : { transcribe: transcribeSettings(values) };
  }
  const playlistMode = values.playlist !== undefined || values.description !== undefined;
  return playlistMode ? playlistSettings(values) : copySettings(values, env);
}

function playlistSettings(values) {
  if (values.playlist === undefined) {
    return "Stopped: --description goes with --playlist <title>";
  }
  if (values["copy-from"] !== undefined) {
    return "Stopped: --playlist doesn't go with --copy-from: copy the videos first, then make the playlist";
  }
  return { playlist: values.playlist, description: values.description };
}

function transcribeSettings(values) {
  return { ytDlp: values["yt-dlp"], cookies: values.cookies, cookiesFromBrowser: values["cookies-from-browser"] };
}

function copySettings(values, env) {
  const copyFrom = values["copy-from"];
  if (!copyFrom) {
    return {};
  }
  const fromToken = values["from-token"] ?? env.SOURCE_CURATOR_TOKEN;
  if (!fromToken) {
    return "Stopped: no source token: set SOURCE_CURATOR_TOKEN or pass --from-token (the source backend's curator token)";
  }
  return { copyFrom, fromToken };
}

async function importer(settings, fetch, download) {
  if (!settings.copyFrom) {
    const client = makeClient({ baseUrl: settings.baseUrl, token: settings.token, fetch });
    const options = await client.options();
    if (settings.transcribe) {
      return { client: makeTranscriber({ client, download: download ?? makeDownloader(settings.transcribe) }), options };
    }
    return { client, options };
  }
  const source = makeClient({ baseUrl: settings.copyFrom, token: settings.fromToken, fetch, label: "source" });
  const target = makeClient({ baseUrl: settings.baseUrl, token: settings.token, fetch, label: "target" });
  await source.options();
  return { client: makeCopier({ source, target }), options: await target.options() };
}

async function importList(settings, { print, sleep, fetch, download }) {
  const text = read(settings.file);
  const { client, options } = await importer(settings, fetch, download);
  const entries = parseList(text, { ...options, defaultLanguage: settings.language?.toLowerCase() ?? null });
  if (settings.playlist !== undefined) {
    return makePlaylist(entries, { client, title: settings.playlist, description: settings.description,
      dryRun: settings.dryRun, print });
  }
  const results = await run(entries, { client, delayMs: settings.delayMs, dryRun: settings.dryRun, sleep, print });
  print(summary(results));
  const total = transcriptionTotal(results);
  if (total) {
    print(total);
  }
  if (!settings.dryRun) {
    save(settings.file, results, print, settings.copyFrom ? ` --copy-from ${settings.copyFrom}` : "");
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

function save(file, results, print, mode) {
  const base = file.replace(/\.[^./\\]*$/, "");
  writeFileSync(`${base}.results.txt`, resultsFile(results));
  print(`Results: ${base}.results.txt`);
  const retry = retryFile(results);
  if (retry) {
    writeFileSync(`${base}.retry.txt`, retry);
    print(`To retry: node tools/import-videos.mjs ${base}.retry.txt${mode}`);
  } else {
    rmSync(`${base}.retry.txt`, { force: true });
  }
}
