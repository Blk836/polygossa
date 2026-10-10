import { test } from "node:test";
import assert from "node:assert/strict";
import { Fatal } from "./client.mjs";
import { makeCopier } from "./copy.mjs";

const entry = { line: 1, url: "https://youtu.be/AAAAAAAAAAA", language: "fr", category: null };
const video = { videoId: "AAAAAAAAAAA", language: "fr", title: "Le marché", content: "Bonjour." };

function world({ exported = { video }, copied = { outcome: "imported", reason: "learners", title: "Le marché" } } = {}) {
  const calls = [];
  const source = { exportVideo: async (e) => { calls.push(["export", e.url]); return exported; } };
  const target = { copyVideo: async (v, dryRun) => { calls.push(["copy", v.videoId, dryRun]); return copied; } };
  return { copier: makeCopier({ source, target }), calls };
}

test("a video is read from the source and sent to the target, reported as copied", async () => {
  const { copier, calls } = world();
  assert.deepEqual(await copier.importVideo(entry, false), { outcome: "copied", reason: "learners", title: "Le marché" });
  assert.deepEqual(calls, [["export", entry.url], ["copy", "AAAAAAAAAAA", false]]);
});

test("a dry run asks the target whether it would copy", async () => {
  const { copier, calls } = world({ copied: { outcome: "would import", reason: "", title: "" } });
  assert.deepEqual(await copier.importVideo(entry, true), { outcome: "would copy", reason: "", title: "" });
  assert.deepEqual(calls[1], ["copy", "AAAAAAAAAAA", true]);
});

test("other outcomes from the target are passed on", async () => {
  for (const outcome of ["already imported", "refused", "failed"]) {
    const { copier } = world({ copied: { outcome, reason: "r", title: "t" } });
    assert.deepEqual(await copier.importVideo(entry, false), { outcome, reason: "r", title: "t" });
  }
});

test("a video the source doesn't have is skipped and the target isn't asked", async () => {
  const { copier, calls } = world({ exported: { missing: "No French copy of AAAAAAAAAAA here" } });
  assert.deepEqual(await copier.importVideo(entry, false),
    { outcome: "skipped", reason: "not on the source: No French copy of AAAAAAAAAAA here", title: "" });
  assert.equal(calls.length, 1);
});

test("an export that fails is reported as failed and the target isn't asked", async () => {
  const { copier, calls } = world({ exported: { failed: "HTTP 500" } });
  assert.deepEqual(await copier.importVideo(entry, false), { outcome: "failed", reason: "source: HTTP 500", title: "" });
  assert.equal(calls.length, 1);
});

test("a fatal error from either backend stops the run", async () => {
  const source = { exportVideo: async () => { throw new Fatal("source: curator token rejected"); } };
  await assert.rejects(makeCopier({ source, target: {} }).importVideo(entry, false),
    new Fatal("source: curator token rejected"));
});
