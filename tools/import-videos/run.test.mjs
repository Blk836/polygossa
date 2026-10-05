import { test } from "node:test";
import assert from "node:assert/strict";
import { Fatal } from "./client.mjs";
import { run } from "./run.mjs";

const a = { line: 1, url: "https://youtu.be/AAAAAAAAAAA", language: "fr", category: null };
const bad = { line: 2, url: "https://example.com", error: "not a YouTube video link" };
const b = { line: 3, url: "https://youtu.be/BBBBBBBBBBB", language: "es", category: "news" };
const c = { line: 4, url: "https://youtu.be/CCCCCCCCCCC", language: "es", category: null };

/** A client whose answers come from a map of URL → outcome (or an Error to throw). */
function fakeClient(answers) {
  const calls = [];
  return {
    calls,
    importVideo: async (entry, dryRun) => {
      calls.push({ url: entry.url, dryRun });
      const answer = answers[entry.url];
      if (answer instanceof Error) {
        throw answer;
      }
      return answer;
    },
  };
}

function harness(answers, settings = {}) {
  const client = fakeClient(answers);
  const sleeps = [];
  const printed = [];
  const go = (entries) => run(entries, {
    client, delayMs: 2000, dryRun: false, ...settings,
    sleep: async (ms) => { sleeps.push(ms); },
    print: (line) => printed.push(line),
  });
  return { client, sleeps, printed, go };
}

const imported = (title) => ({ outcome: "imported", reason: "food", title });

test("every valid line is imported in order, invalid ones reported without contacting the backend", async () => {
  const h = harness({ [a.url]: imported("Un"), [b.url]: imported("Dos") });
  const results = await h.go([a, bad, b]);
  assert.deepEqual(h.client.calls, [{ url: a.url, dryRun: false }, { url: b.url, dryRun: false }]);
  assert.deepEqual(results.map((r) => [r.entry.line, r.outcome, r.reason, r.title]), [
    [1, "imported", "food", "Un"],
    [2, "invalid", "not a YouTube video link", ""],
    [3, "imported", "food", "Dos"],
  ]);
});

test("each result is printed as it happens", async () => {
  const h = harness({ [a.url]: imported("Un") });
  await h.go([a, bad]);
  assert.deepEqual(h.printed, [
    "line 1: imported — Un (food) https://youtu.be/AAAAAAAAAAA",
    "line 2: invalid — not a YouTube video link https://example.com",
  ]);
});

test("it waits between videos (not before the first, not after invalid lines)", async () => {
  const h = harness({ [a.url]: imported("Un"), [b.url]: imported("Dos"), [c.url]: imported("Tres") });
  await h.go([a, bad, b, c]);
  assert.deepEqual(h.sleeps, [2000, 2000]);
});

test("a dry run asks with dryRun and never waits", async () => {
  const h = harness({ [a.url]: { outcome: "would import", reason: "", title: "" } }, { dryRun: true });
  const [result] = await h.go([a]);
  assert.deepEqual(h.client.calls, [{ url: a.url, dryRun: true }]);
  assert.equal(result.outcome, "would import");
  assert.deepEqual(h.sleeps, []);
});

test("a failed video doesn't stop the run", async () => {
  const h = harness({ [a.url]: { outcome: "skipped", reason: "no captions", title: "" }, [b.url]: imported("Dos") });
  const results = await h.go([a, b]);
  assert.deepEqual(results.map((r) => r.outcome), ["skipped", "imported"]);
});

test("a fatal error stops the run; the rest are marked not run", async () => {
  const h = harness({ [a.url]: imported("Un"), [b.url]: new Fatal("curator token rejected") });
  const results = await h.go([a, b, bad, c]);
  assert.deepEqual(h.client.calls.map((call) => call.url), [a.url, b.url]);
  assert.deepEqual(results.map((r) => [r.outcome, r.reason]), [
    ["imported", "food"],
    ["not run", "curator token rejected"],
    ["invalid", "not a YouTube video link"],
    ["not run", "curator token rejected"],
  ]);
  assert.equal(results.fatal, "curator token rejected");
});

test("an unexpected error is not swallowed", async () => {
  const h = harness({ [a.url]: new RangeError("bug") });
  await assert.rejects(h.go([a]), RangeError);
});

test("a fatal result has no title", async () => {
  const h = harness({ [a.url]: new Fatal("curator token rejected") });
  const [result] = await h.go([a]);
  assert.equal(result.title, "");
  assert.equal("fatal" in result, false);
});

test("printed lines show the title alone, the reason alone, or just the outcome", async () => {
  const h = harness({
    [a.url]: { outcome: "already imported", reason: "", title: "Un" },
    [b.url]: { outcome: "would import", reason: "", title: "" },
  });
  await h.go([a, b]);
  assert.deepEqual(h.printed, [
    "line 1: already imported — Un https://youtu.be/AAAAAAAAAAA",
    "line 3: would import https://youtu.be/BBBBBBBBBBB",
  ]);
});
