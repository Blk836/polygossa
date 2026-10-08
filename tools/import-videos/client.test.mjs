import { test } from "node:test";
import assert from "node:assert/strict";
import { Fatal, makeClient } from "./client.mjs";

const entry = { line: 3, url: "https://youtu.be/AAAAAAAAAAA", language: "fr", category: null };

/** A fetch that records its calls and answers with the given status and JSON body. */
function fakeFetch(status, body) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

const client = (fetch) => makeClient({ baseUrl: "http://localhost:8080/", token: "s3cret", fetch });

test("options are fetched with the curator token", async () => {
  const { fetch, calls } = fakeFetch(200, { languages: ["fr"], categories: ["news"] });
  assert.deepEqual(await client(fetch).options(), { languages: ["fr"], categories: ["news"] });
  assert.equal(calls[0].url, "http://localhost:8080/api/curator/options");
  assert.equal(calls[0].init.headers["X-Curator-Token"], "s3cret");
});

test("a video is posted as JSON with the token", async () => {
  const { fetch, calls } = fakeFetch(201, { outcome: "imported", title: "Le marché", category: "food" });
  await client(fetch).importVideo({ ...entry, category: "news" }, false);
  assert.equal(calls[0].url, "http://localhost:8080/api/curator/videos");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers["X-Curator-Token"], "s3cret");
  assert.deepEqual(JSON.parse(calls[0].init.body),
    { url: entry.url, language: "fr", category: "news", dryRun: false });
});

test("a dry run asks the backend without importing", async () => {
  const { fetch, calls } = fakeFetch(200, { outcome: "would_import" });
  assert.deepEqual(await client(fetch).importVideo(entry, true), { outcome: "would import", reason: "", title: "" });
  assert.equal(JSON.parse(calls[0].init.body).dryRun, true);
  assert.equal("category" in JSON.parse(calls[0].init.body), false);
});

const cases = [
  [201, { outcome: "imported", title: "Le marché", category: "food" }, { outcome: "imported", reason: "food", title: "Le marché" }],
  [200, { outcome: "already_imported", title: "Le marché" }, { outcome: "already imported", reason: "", title: "Le marché" }],
  [422, { code: "no_captions", message: "No French captions found" }, { outcome: "skipped", reason: "no captions: No French captions found", title: "" }],
  [422, { code: "not_shareable", message: "This can't be shared: Graphic violence." }, { outcome: "refused", reason: "This can't be shared: Graphic violence.", title: "" }],
  [503, { code: "review_unavailable", message: "We couldn't check" }, { outcome: "failed", reason: "review unavailable: We couldn't check", title: "" }],
  [422, { code: "unprocessable", message: "This video isn't available" }, { outcome: "failed", reason: "This video isn't available", title: "" }],
  [500, undefined, { outcome: "failed", reason: "HTTP 500", title: "" }],
  [300, {}, { outcome: "failed", reason: "HTTP 300", title: "" }],
];
for (const [status, body, expected] of cases) {
  test(`HTTP ${status} ${body?.code ?? body?.outcome ?? ""} is reported as ${expected.outcome}`, async () => {
    assert.deepEqual(await client(fakeFetch(status, body).fetch).importVideo(entry, false), expected);
  });
}

test("a rejected token stops the run", async () => {
  await assert.rejects(client(fakeFetch(401, { code: "unauthorized" }).fetch).importVideo(entry, false),
    new Fatal("curator token rejected"));
  await assert.rejects(client(fakeFetch(401, {}).fetch).options(), new Fatal("curator token rejected"));
});

test("a backend without a curator token stops the run", async () => {
  await assert.rejects(client(fakeFetch(404, {}).fetch).options(),
    new Fatal("bulk import is off on the backend: start it with CURATOR_TOKEN set"));
});

test("an unreachable backend stops the run", async () => {
  const refused = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(client(refused).options(), new Fatal("backend not reachable at http://localhost:8080"));
  await assert.rejects(client(refused).importVideo(entry, false), new Fatal("backend not reachable at http://localhost:8080"));
});

test("options that aren't usable stop the run", async () => {
  await assert.rejects(client(fakeFetch(500, {}).fetch).options(), new Fatal("could not read the backend's options (HTTP 500)"));
});

test("options missing either list stop the run", async () => {
  for (const body of [{ languages: ["fr"] }, { categories: ["news"] }]) {
    await assert.rejects(client(fakeFetch(200, body).fetch).options(), new Fatal("could not read the backend's options (HTTP 200)"));
  }
});

test("trailing slashes on the backend address are dropped", async () => {
  const { fetch, calls } = fakeFetch(200, { languages: [], categories: [] });
  await makeClient({ baseUrl: "http://localhost:8080//", token: "t", fetch }).options();
  assert.equal(calls[0].url, "http://localhost:8080/api/curator/options");
});

test("options from a failed request stop the run even if they look usable", async () => {
  await assert.rejects(client(fakeFetch(500, { languages: ["fr"], categories: ["news"] }).fetch).options(),
    new Fatal("could not read the backend's options (HTTP 500)"));
});

// ---- copying between backends (docs/acceptance/copy-videos.feature) ----

const exported = { videoId: "AAAAAAAAAAA", language: "fr", title: "Le marché", category: "learners", durationSeconds: 60,
  content: "Bonjour.", cues: [] };

test("a video's copy is fetched from the source by id and language, with the token", async () => {
  const { fetch, calls } = fakeFetch(200, exported);
  assert.deepEqual(await client(fetch).exportVideo({ ...entry, url: "https://www.youtube.com/watch?v=AAAAAAAAAAA&t=3" }),
    { video: exported });
  assert.equal(calls[0].url, "http://localhost:8080/api/curator/videos/AAAAAAAAAAA/copy?language=fr");
  assert.equal(calls[0].init.headers["X-Curator-Token"], "s3cret");
});

test("a video the source doesn't have is reported, not fatal", async () => {
  const { fetch } = fakeFetch(404, { code: "not_on_source", message: "No French copy of AAAAAAAAAAA here" });
  assert.deepEqual(await client(fetch).exportVideo(entry), { missing: "No French copy of AAAAAAAAAAA here" });
});

test("an export that fails otherwise is reported as failed", async () => {
  assert.deepEqual(await client(fakeFetch(500, {}).fetch).exportVideo(entry), { failed: "HTTP 500" });
});

test("a copy is posted to the target as JSON with the token and the dry-run flag", async () => {
  const { fetch, calls } = fakeFetch(201, { outcome: "imported", title: "Le marché", category: "learners" });
  assert.deepEqual(await client(fetch).copyVideo(exported, false),
    { outcome: "imported", reason: "learners", title: "Le marché" });
  assert.equal(calls[0].url, "http://localhost:8080/api/curator/copies");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["Content-Type"], "application/json");
  assert.equal(calls[0].init.headers["X-Curator-Token"], "s3cret");
  assert.deepEqual(JSON.parse(calls[0].init.body), { ...exported, dryRun: false });
});

test("a copy the target's AI refuses is reported as refused", async () => {
  const { fetch } = fakeFetch(422, { code: "not_shareable", message: "This can't be shared: Graphic violence." });
  assert.deepEqual(await client(fetch).copyVideo(exported, false),
    { outcome: "refused", reason: "This can't be shared: Graphic violence.", title: "" });
});

test("a named backend says which one stopped the run", async () => {
  const named = (fetch) => makeClient({ baseUrl: "http://localhost:8080", token: "t", fetch, label: "source" });
  await assert.rejects(named(fakeFetch(401, {}).fetch).exportVideo(entry), new Fatal("source: curator token rejected"));
  await assert.rejects(named(fakeFetch(404, {}).fetch).options(),
    new Fatal("source: bulk import is off on the backend: start it with CURATOR_TOKEN set"));
  const refused = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(named(refused).options(), new Fatal("source: backend not reachable at http://localhost:8080"));
});
