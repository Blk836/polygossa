import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./cli.mjs";

const OPTIONS = { languages: ["fr", "es"], categories: ["learners", "other"] };
const VIDEO = { videoId: "AAAAAAAAAAA", language: "fr", title: "Le marché", category: "learners", durationSeconds: 60,
  content: "Bonjour.", cues: [] };

let sourceServer;
let targetServer;
let source;
let target;
let requests;
let targetAnswer;

function stand(name, token, answer) {
  return createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      requests.push({ backend: name, path: req.url, token: req.headers["x-curator-token"], body: body ? JSON.parse(body) : null });
      const [status, json] = req.headers["x-curator-token"] !== token ? [401, {}]
        : req.url === "/api/curator/options" ? [200, OPTIONS] : answer(req.url, body ? JSON.parse(body) : null);
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(json));
    });
  });
}

async function listen(server) {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

before(async () => {
  sourceServer = stand("source", "local", (url) => url === "/api/curator/videos/AAAAAAAAAAA/copy?language=fr" ? [200, VIDEO]
    : [404, { code: "not_on_source", message: "No copy here" }]);
  targetServer = stand("target", "prod", (url, body) => targetAnswer(body));
  source = await listen(sourceServer);
  target = await listen(targetServer);
});

after(() => {
  sourceServer.close();
  targetServer.close();
});

beforeEach(() => {
  requests = [];
  targetAnswer = (body) => body.dryRun ? [200, { outcome: "would_import" }]
    : [201, { outcome: "imported", title: body.title, category: body.category }];
});

function listFile(text) {
  const file = join(mkdtempSync(join(tmpdir(), "copy-videos-")), "videos.txt");
  writeFileSync(file, text);
  return file;
}

async function cli(args, env = { CURATOR_TOKEN: "prod", SOURCE_CURATOR_TOKEN: "local", BACKEND_URL: target }) {
  const printed = [];
  const code = await main(args, { env, print: (line) => printed.push(line), sleep: async () => {} });
  return { code, out: printed.join("\n") };
}

const LIST = "https://youtu.be/AAAAAAAAAAA fr\nhttps://youtu.be/BBBBBBBBBBB fr\n";

test("copy mode reads each video from the source and saves it on the target", async () => {
  const file = listFile(LIST);
  const { code, out } = await cli([file, "--copy-from", source]);
  assert.equal(code, 0);
  assert.match(out, /line 1: copied — Le marché \(learners\)/);
  assert.match(out, /line 2: skipped — not on the source: No copy here/);
  assert.match(out, /2 lines: 1 copied, 1 skipped/);
  const copies = requests.filter((r) => r.path === "/api/curator/copies");
  assert.deepEqual(copies.map((r) => r.body), [{ ...VIDEO, dryRun: false }]);
  assert.ok(requests.every((r) => r.token === (r.backend === "source" ? "local" : "prod")));
  assert.equal(readFileSync(file.replace(/\.txt$/, ".retry.txt"), "utf8"),
    "https://youtu.be/BBBBBBBBBBB fr  # skipped: not on the source: No copy here\n");
  assert.ok(out.includes(`To retry: node tools/import-videos.mjs ${file.replace(/\.txt$/, "")}.retry.txt --copy-from ${source}`),
    out);
});

test("a copy dry run reports would copy and writes nothing", async () => {
  const file = listFile("https://youtu.be/AAAAAAAAAAA fr\n");
  const { code, out } = await cli([file, "--copy-from", source, "--dry-run"]);
  assert.equal(code, 0);
  assert.match(out, /line 1: would copy/);
  assert.equal(requests.find((r) => r.path === "/api/curator/copies").body.dryRun, true);
  assert.equal(existsSync(file.replace(/\.txt$/, ".results.txt")), false);
});

test("--from-token gives the source's token", async () => {
  const { code } = await cli([listFile(LIST), "--copy-from", source, "--from-token", "local"],
    { CURATOR_TOKEN: "prod", BACKEND_URL: target });
  assert.equal(code, 0);
});

test("copy mode without a source token is explained", async () => {
  const { code, out } = await cli([listFile(LIST), "--copy-from", source], { CURATOR_TOKEN: "prod", BACKEND_URL: target });
  assert.equal(code, 1);
  assert.match(out, /no source token: set SOURCE_CURATOR_TOKEN or pass --from-token/);
});

test("a source rejecting its token stops before any video, saying it was the source", async () => {
  const { code, out } = await cli([listFile(LIST), "--copy-from", source],
    { CURATOR_TOKEN: "prod", SOURCE_CURATOR_TOKEN: "wrong", BACKEND_URL: target });
  assert.equal(code, 1);
  assert.match(out, /Stopped: source: curator token rejected/);
  assert.equal(requests.filter((r) => r.path.startsWith("/api/curator/copies")).length, 0);
});

test("a target rejecting its token stops before any video, saying it was the target", async () => {
  const { code, out } = await cli([listFile(LIST), "--copy-from", source],
    { CURATOR_TOKEN: "wrong", SOURCE_CURATOR_TOKEN: "local", BACKEND_URL: target });
  assert.equal(code, 1);
  assert.match(out, /Stopped: target: curator token rejected/);
});

test("an unreachable source stops the run", async () => {
  const { code, out } = await cli([listFile(LIST), "--copy-from", "http://127.0.0.1:1"]);
  assert.equal(code, 1);
  assert.match(out, /source: backend not reachable at http:\/\/127\.0\.0\.1:1/);
});

test("a target failing partway stops the run and marks the rest for a retry", async () => {
  targetAnswer = () => [401, {}];
  const file = listFile("https://youtu.be/AAAAAAAAAAA fr\n");
  const { code, out } = await cli([file, "--copy-from", source]);
  assert.equal(code, 1);
  assert.match(out, /1 line: 1 not run/);
  assert.match(out, /Stopped: target: curator token rejected$/);
});
