import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./cli.mjs";

let server;
let backend;
let requests;
let videos;
let sleeps;

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      requests.push({ path: req.url, token: req.headers["x-curator-token"], body: body ? JSON.parse(body) : null });
      const [status, answer] = req.headers["x-curator-token"] !== "s3cret" ? [401, {}]
        : req.url === "/api/curator/options" ? [200, { languages: ["fr", "es"], categories: ["news", "other"] }]
          : videos[JSON.parse(body).url] ?? [500, {}];
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(answer));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  backend = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => {
  requests = [];
  sleeps = [];
  videos = {
    "https://youtu.be/AAAAAAAAAAA": [201, { outcome: "imported", title: "Le marché", category: "news" }],
    "https://youtu.be/BBBBBBBBBBB": [422, { code: "no_captions", message: "No Spanish captions found" }],
    "https://youtu.be/CCCCCCCCCCC": [401, { code: "unauthorized" }],
  };
});

function listFile(text, name = "videos.txt") {
  const file = join(mkdtempSync(join(tmpdir(), "import-videos-")), name);
  writeFileSync(file, text);
  return file;
}

async function cli(args, env = { CURATOR_TOKEN: "s3cret", BACKEND_URL: backend }, fetch = undefined) {
  const printed = [];
  const sleep = async (ms) => { sleeps.push(ms); };
  const code = await main(args, { env, print: (line) => printed.push(line), sleep, fetch });
  return { code, out: printed.join("\n") };
}

const LIST = "https://youtu.be/AAAAAAAAAAA fr\nnope fr\nhttps://youtu.be/BBBBBBBBBBB es\n";

test("a run imports the list, prints each line and a summary, and writes the results and retry files", async () => {
  const file = listFile(LIST);
  const { code, out } = await cli([file]);
  assert.equal(code, 0);
  assert.match(out, /line 1: imported — Le marché \(news\)/);
  assert.match(out, /line 2: invalid — not a YouTube video link/);
  assert.match(out, /line 3: skipped — no captions: No Spanish captions found/);
  assert.match(out, /3 lines: 1 imported, 1 skipped, 1 invalid/);
  assert.equal(readFileSync(file.replace(/\.txt$/, ".results.txt"), "utf8").split("\n").length, 4);
  assert.equal(readFileSync(file.replace(/\.txt$/, ".retry.txt"), "utf8"),
    "https://youtu.be/BBBBBBBBBBB es  # skipped: no captions: No Spanish captions found\n");
  assert.deepEqual(requests.map((r) => r.path), ["/api/curator/options", "/api/curator/videos", "/api/curator/videos"]);
  assert.ok(requests.every((r) => r.token === "s3cret"));
});

test("--language, --token and --backend override the defaults", async () => {
  const file = listFile("https://youtu.be/AAAAAAAAAAA\n");
  const { code } = await cli([file, "--language", "fr", "--token", "s3cret", "--backend", backend], {});
  assert.equal(code, 0);
  assert.equal(requests[1].body.language, "fr");
});

test("a dry run reports and writes nothing", async () => {
  videos["https://youtu.be/AAAAAAAAAAA"] = [200, { outcome: "would_import" }];
  const file = listFile("https://youtu.be/AAAAAAAAAAA fr\n");
  const { code, out } = await cli([file, "--dry-run"]);
  assert.equal(code, 0);
  assert.match(out, /line 1: would import/);
  assert.equal(requests[1].body.dryRun, true);
  assert.equal(existsSync(file.replace(/\.txt$/, ".results.txt")), false);
});

test("no retry file is written when nothing needs retrying, and an old one is removed", async () => {
  const file = listFile("https://youtu.be/AAAAAAAAAAA fr\n");
  writeFileSync(file.replace(/\.txt$/, ".retry.txt"), "old");
  await cli([file]);
  assert.equal(existsSync(file.replace(/\.txt$/, ".retry.txt")), false);
});

test("a wrong token stops before any video, with a non-zero exit code", async () => {
  const file = listFile(LIST);
  const { code, out } = await cli([file], { CURATOR_TOKEN: "wrong", BACKEND_URL: backend });
  assert.equal(code, 1);
  assert.match(out, /curator token rejected/);
  assert.deepEqual(requests.map((r) => r.path), ["/api/curator/options"]);
});

test("an unreachable backend stops the run", async () => {
  const { code, out } = await cli([listFile(LIST)], { CURATOR_TOKEN: "s3cret", BACKEND_URL: "http://127.0.0.1:1" });
  assert.equal(code, 1);
  assert.match(out, /backend not reachable at http:\/\/127\.0\.0\.1:1/);
});

test("missing arguments print the usage", async () => {
  for (const args of [[], ["a.txt", "b.txt"], ["--delay", "x", "a.txt"]]) {
    const { code, out } = await cli(args);
    assert.equal(code, 1, args.join(" "));
    assert.match(out, /Usage: node tools\/import-videos.mjs <list-file>/);
  }
});

test("a missing token or list file is explained", async () => {
  assert.match((await cli([listFile(LIST)], { BACKEND_URL: backend })).out, /no curator token: set CURATOR_TOKEN or pass --token/);
  const missing = await cli([join(tmpdir(), "no-such-list.txt")]);
  assert.equal(missing.code, 1);
  assert.match(missing.out, /can't read .*no-such-list\.txt/);
});

test("the results and retry files are named in the output", async () => {
  const file = listFile(LIST);
  const base = file.replace(/\.txt$/, "");
  const { out } = await cli([file]);
  assert.ok(out.includes(`Results: ${base}.results.txt`), out);
  assert.ok(out.includes(`To retry: node tools/import-videos.mjs ${base}.retry.txt`), out);
});

test("a list file without an extension, in a folder with a dot, gets files next to it", async () => {
  const dir = join(mkdtempSync(join(tmpdir(), "import-videos-")), "lists.v2");
  mkdirSync(dir);
  const file = join(dir, "french");
  writeFileSync(file, "https://youtu.be/AAAAAAAAAAA fr\n");
  await cli([file]);
  assert.equal(existsSync(join(dir, "french.results.txt")), true);
});

test("videos are 2 seconds apart by default; --delay changes it, and 0 is allowed", async () => {
  const twoVideos = "https://youtu.be/AAAAAAAAAAA fr\nhttps://youtu.be/BBBBBBBBBBB es\n";
  await cli([listFile(twoVideos)]);
  await cli([listFile(twoVideos), "--delay", "0.5"]);
  const { code } = await cli([listFile(twoVideos), "--delay", "0"]);
  assert.equal(code, 0);
  assert.deepEqual(sleeps, [2000, 500, 0]);
});

test("an unknown option is explained, with the usage", async () => {
  const { code, out } = await cli([listFile(LIST), "--bogus"]);
  assert.equal(code, 1);
  assert.match(out, /Unknown option '--bogus'/);
  assert.match(out, /Usage:/);
});

test("the backend defaults to localhost:8080", async () => {
  const urls = [];
  const fetch = async (url) => { urls.push(url); return new Response("{}", { status: 401 }); };
  await cli([listFile(LIST)], { CURATOR_TOKEN: "s3cret" }, fetch);
  assert.deepEqual(urls, ["http://localhost:8080/api/curator/options"]);
});

test("a token rejected partway stops the run, keeps what was done and marks the rest for a retry", async () => {
  const file = listFile("https://youtu.be/AAAAAAAAAAA fr\nhttps://youtu.be/CCCCCCCCCCC fr\nhttps://youtu.be/BBBBBBBBBBB es\n");
  const { code, out } = await cli([file]);
  assert.equal(code, 1);
  assert.match(out, /3 lines: 1 imported, 2 not run\nResults: .*\nTo retry: .*\nStopped: curator token rejected$/);
  assert.equal(readFileSync(file.replace(/\.txt$/, ".retry.txt"), "utf8"),
    "https://youtu.be/CCCCCCCCCCC fr  # not run: curator token rejected\n"
    + "https://youtu.be/BBBBBBBBBBB es  # not run: curator token rejected\n");
});

test("an unexpected error isn't hidden behind an exit code", async () => {
  const file = listFile("https://youtu.be/AAAAAAAAAAA fr\n");
  mkdirSync(file.replace(/\.txt$/, ".results.txt"));
  await assert.rejects(cli([file]), { code: "EISDIR" });
});
