import { test } from "node:test";
import assert from "node:assert/strict";
import { makePlaylist } from "./playlist.mjs";

const entries = [
  { line: 1, url: "https://youtu.be/CCCCCCCCCCC", language: "fr", category: null },
  { line: 2, url: "nope", error: "not a YouTube video link" },
  { line: 3, url: "https://www.youtube.com/watch?v=AAAAAAAAAAA", language: "fr", category: null },
  { line: 4, url: "https://youtu.be/BBBBBBBBBBB", language: "fr", category: "news" },
];

function run(answer, { list = entries, dryRun = false, description } = {}) {
  const sent = [];
  const printed = [];
  const client = { savePlaylist: async (request) => { sent.push(request); return answer; } };
  return makePlaylist(list, { client, title: "Series", description, dryRun, print: (l) => printed.push(l) })
    .then((code) => ({ code, sent, out: printed.join("\n") }));
}

test("the list's video ids are sent in order with the title, description and language", async () => {
  const { code, sent, out } = await run({ status: 201, body: { outcome: "created", id: 7, title: "Series", items: 3, missing: [] } },
    { description: "Episodes" });
  assert.equal(code, 0);
  assert.deepEqual(sent, [{ title: "Series", description: "Episodes", language: "fr",
    videoIds: ["CCCCCCCCCCC", "AAAAAAAAAAA", "BBBBBBBBBBB"], dryRun: false }]);
  assert.match(out, /line 2: invalid — not a YouTube video link/);
  assert.match(out, /Playlist "Series": created, 3 videos/);
});

test("videos left out are listed with their lines", async () => {
  const { code, out } = await run({ status: 200, body: { outcome: "updated", id: 7, title: "Series", items: 2,
    missing: ["AAAAAAAAAAA"] } });
  assert.equal(code, 0);
  assert.match(out, /Playlist "Series": updated, 2 videos/);
  assert.match(out, /Left out \(not in the community library\): line 3 https:\/\/www\.youtube\.com\/watch\?v=AAAAAAAAAAA/);
});

test("a dry run says what would happen", async () => {
  const { sent, out } = await run({ status: 200, body: { outcome: "would_create", title: "Series", items: 3, missing: [] } },
    { dryRun: true });
  assert.equal(sent[0].dryRun, true);
  assert.match(out, /Playlist "Series": would create, 3 videos/);
});

test("a refused playlist stops with the backend's reason", async () => {
  const { code, out } = await run({ status: 422, body: { code: "no_videos", message: "None of these videos are in the community library in French" } });
  assert.equal(code, 1);
  assert.match(out, /Stopped: None of these videos are in the community library in French/);
});

test("a list mixing languages is refused before the backend is asked", async () => {
  const mixed = [...entries, { line: 5, url: "https://youtu.be/DDDDDDDDDDD", language: "es", category: null }];
  const { code, sent, out } = await run({ status: 201, body: {} }, { list: mixed });
  assert.equal(code, 1);
  assert.equal(sent.length, 0);
  assert.match(out, /Stopped: a playlist is in one language; the list has fr and es/);
});

test("a list with no usable lines is refused before the backend is asked", async () => {
  const { code, sent, out } = await run({ status: 201, body: {} }, { list: [entries[1]] });
  assert.equal(code, 1);
  assert.equal(sent.length, 0);
  assert.match(out, /Stopped: no videos in the list/);
});
