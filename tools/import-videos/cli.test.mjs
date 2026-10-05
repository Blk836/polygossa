import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./cli.mjs";

/** A stand-in for the backend's curator endpoints: records requests, answers from `videos` (URL → [status, body]). */
let server;
let backend;
let requests;
let videos;

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
  videos = {
    "https://youtu.be/AAAAAAAAAAA": [201, { outcome: "imported", title: "Le marché", category: "news" }],
    "https://youtu.be/BBBBBBBBBBB": [422, { code: "no_captions", message: "No Spanish captions found" }],
  };
});

function listFile(text) {
  const file = join(mkdtempSync(join(tmpdir(), "import-videos-")), "videos.txt");
  writeFileSync(file, text);
  return file;
}

async function cli(args, env = { CURATOR_TOKEN: "s3cret", BACKEND_URL: backend }) {
  const printed = [];
  const code = await main(args, { env, print: (line) => printed.push(line), sleep: async () => {} });
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
