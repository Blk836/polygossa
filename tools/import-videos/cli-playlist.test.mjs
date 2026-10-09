import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "./cli.mjs";

// --playlist (docs/acceptance/copy-playlist.feature), against a stand-in backend.

let server;
let backend;
let requests;

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const json = body ? JSON.parse(body) : null;
      requests.push({ path: req.url, body: json });
      const [status, answer] = req.headers["x-curator-token"] !== "s3cret" ? [401, {}]
        : req.url === "/api/curator/options" ? [200, { languages: ["fr", "es"], categories: ["news"] }]
          : [201, { outcome: "created", id: 4, title: json.title, items: json.videoIds.length, missing: [] }];
      res.writeHead(status, { "Content-Type": "application/json" }).end(JSON.stringify(answer));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  backend = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

beforeEach(() => { requests = []; });

function listFile(text) {
  const file = join(mkdtempSync(join(tmpdir(), "playlist-")), "videos.txt");
  writeFileSync(file, text);
  return file;
}

async function cli(args) {
  const printed = [];
  const code = await main(args, { env: { CURATOR_TOKEN: "s3cret", BACKEND_URL: backend }, print: (l) => printed.push(l),
    sleep: async () => {} });
  return { code, out: printed.join("\n") };
}

test("--playlist makes a playlist of the list's videos instead of importing them", async () => {
  const file = listFile("https://youtu.be/BBBBBBBBBBB fr\nhttps://youtu.be/AAAAAAAAAAA fr\n");
  const { code, out } = await cli([file, "--playlist", "innerFrench 1-200", "--description", "Episodes 1 to 200"]);
  assert.equal(code, 0);
  assert.match(out, /Playlist "innerFrench 1-200": created, 2 videos/);
  assert.deepEqual(requests.map((r) => r.path), ["/api/curator/options", "/api/curator/playlists"]);
  assert.deepEqual(requests[1].body, { title: "innerFrench 1-200", description: "Episodes 1 to 200", language: "fr",
    videoIds: ["BBBBBBBBBBB", "AAAAAAAAAAA"], dryRun: false });
  assert.equal(existsSync(file.replace(/\.txt$/, ".results.txt")), false);
});

test("--playlist with --dry-run asks without saving", async () => {
  await cli([listFile("https://youtu.be/AAAAAAAAAAA fr\n"), "--playlist", "Series", "--dry-run"]);
  assert.equal(requests[1].body.dryRun, true);
});

test("--description without --playlist is explained", async () => {
  const { code, out } = await cli([listFile("https://youtu.be/AAAAAAAAAAA fr\n"), "--description", "x"]);
  assert.equal(code, 1);
  assert.match(out, /--description goes with --playlist/);
  assert.equal(requests.length, 0);
});
