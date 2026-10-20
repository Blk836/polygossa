import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./cli.mjs";

const CAPTIONED = "https://youtu.be/AAAAAAAAAAA";
const SILENT = "https://youtu.be/BBBBBBBBBBB";
const LONG = "https://youtu.be/CCCCCCCCCCC";

let server;
let backend;
let requests;
let quotes;
let off;

function answer(req, body) {
  if (req.url === "/api/curator/options") {
    return [200, { languages: ["es"], categories: ["news"] }];
  }
  if (off && req.url.startsWith("/api/curator/transcriptions")) {
    return [503, { code: "transcription_off", message: "transcription is switched off on the backend: start it with OPENAI_API_KEY set" }];
  }
  if (req.url === "/api/curator/transcriptions/quote") {
    return [200, quotes[JSON.parse(body).url]];
  }
  if (req.url === "/api/curator/transcriptions") {
    return [201, { outcome: "transcribed", title: "Noticias", category: "news" }];
  }
  const { dryRun } = JSON.parse(body);
  return dryRun ? [200, { outcome: "would_import" }] : [201, { outcome: "imported", title: "La cocina", category: "news" }];
}

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      requests.push({ path: req.url, body });
      const [status, reply] = answer(req, body);
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(reply));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  backend = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
  requests = [];
  off = false;
  quotes = {
    [CAPTIONED]: { outcome: "has_captions" },
    [SILENT]: { outcome: "would_transcribe", durationSeconds: 600, costUsd: 0.06 },
    [LONG]: { outcome: "too_long", message: "45 min is over the 30-minute limit" },
  };
});

function listFile(text) {
  const file = join(mkdtempSync(join(tmpdir(), "import-videos-")), "videos.txt");
  writeFileSync(file, text);
  return file;
}

async function cli(args) {
  const printed = [];
  const downloads = [];
  const download = async (url) => {
    downloads.push(url);
    return { bytes: Buffer.from("opus"), filename: "audio.webm" };
  };
  const code = await main(args, { env: { CURATOR_TOKEN: "s3cret", BACKEND_URL: backend }, print: (line) => printed.push(line),
    sleep: async () => {}, download });
  return { code, out: printed.join("\n"), downloads };
}

const LIST = `${CAPTIONED} es\n${SILENT} es\n${LONG} es\n`;

test("--transcribe imports captioned videos from captions and transcribes the rest", async () => {
  const file = listFile(LIST);
  const { code, out, downloads } = await cli([file, "--transcribe"]);
  assert.equal(code, 0);
  assert.deepEqual(downloads, [SILENT]);
  assert.match(out, /line 1: imported — La cocina \(news\)/);
  assert.match(out, /line 2: transcribed — Noticias \(news\)/);
  assert.match(out, /line 3: skipped — 45 min is over the 30-minute limit/);
  assert.match(out, /3 lines: 1 imported, 1 transcribed, 1 skipped/);
  assert.match(out, /Transcription: 1 video, 10 min, about \$0\.06/);
  assert.match(readFileSync(file.replace(/\.txt$/, ".retry.txt"), "utf8"), /CCCCCCCCCCC/);
});

test("a dry run lists the cost of each video and the total, and downloads nothing", async () => {
  quotes[LONG] = { outcome: "would_transcribe", durationSeconds: 1500, costUsd: 0.15 };
  const { code, out, downloads } = await cli([listFile(LIST), "--transcribe", "--dry-run"]);
  assert.equal(code, 0);
  assert.deepEqual(downloads, []);
  assert.match(out, /line 2: would transcribe — 10:00, about \$0\.06/);
  assert.match(out, /line 3: would transcribe — 25:00, about \$0\.15/);
  assert.match(out, /Transcription: 2 videos, 35 min, about \$0\.21/);
  assert.equal(requests.some((r) => r.path === "/api/curator/transcriptions"), false);
});

test("transcription switched off on the backend stops the run", async () => {
  off = true;
  const { code, out } = await cli([listFile(LIST), "--transcribe"]);
  assert.equal(code, 1);
  assert.match(out, /Stopped: transcription is switched off on the backend/);
});

test("without --transcribe, nothing is quoted or downloaded", async () => {
  const { downloads } = await cli([listFile(`${CAPTIONED} es\n`)]);
  assert.deepEqual(downloads, []);
  assert.equal(requests.some((r) => r.path.startsWith("/api/curator/transcriptions")), false);
});

for (const other of [["--copy-from", "http://source"], ["--playlist", "Series"]]) {
  test(`--transcribe doesn't go with ${other[0]}`, async () => {
    const { code, out } = await cli([listFile(LIST), "--transcribe", ...other, "--from-token", "x"]);
    assert.equal(code, 1);
    assert.match(out, new RegExp(`Stopped: --transcribe doesn't go with ${other[0]}`));
  });
}
