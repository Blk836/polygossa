import { test } from "node:test";
import assert from "node:assert/strict";
import { Fatal } from "./client.mjs";
import { makeTranscriber } from "./transcribe.mjs";

const entry = { line: 1, url: "https://youtu.be/AAAAAAAAAAA", language: "es", category: "news" };
const AUDIO = { bytes: Buffer.from("opus"), filename: "audio.webm" };

function harness(quote, { download = async () => AUDIO } = {}) {
  const calls = [];
  const client = {
    async quoteTranscription(e) {
      calls.push(["quote", e.url]);
      if (quote instanceof Error) {
        throw quote;
      }
      return quote;
    },
    async importVideo(e, dryRun) {
      calls.push(["import", e.url, dryRun]);
      return { outcome: dryRun ? "would import" : "imported", reason: "news", title: "La cocina" };
    },
    async transcribe(e, audio) {
      calls.push(["transcribe", e.url, audio.filename]);
      return { outcome: "transcribed", reason: "news", title: "Noticias" };
    },
  };
  const downloads = [];
  const transcriber = makeTranscriber({ client, download: async (url) => { downloads.push(url); return download(url); } });
  return { calls, downloads, transcriber };
}

test("a video with captions is imported from them, with nothing downloaded or transcribed", async () => {
  const h = harness({ outcome: "has_captions", videoId: "AAAAAAAAAAA" });
  assert.deepEqual(await h.transcriber.importVideo(entry, false), { outcome: "imported", reason: "news", title: "La cocina" });
  assert.deepEqual(h.calls, [["quote", entry.url], ["import", entry.url, false]]);
  assert.deepEqual(h.downloads, []);
});

test("a video without captions is downloaded and transcribed", async () => {
  const h = harness({ outcome: "would_transcribe", durationSeconds: 600, costUsd: 0.06 });
  const result = await h.transcriber.importVideo(entry, false);
  assert.deepEqual(result, { outcome: "transcribed", reason: "news", title: "Noticias", seconds: 600, costUsd: 0.06 });
  assert.deepEqual(h.downloads, [entry.url]);
  assert.deepEqual(h.calls.at(-1), ["transcribe", entry.url, "audio.webm"]);
});

test("a dry run states the length and cost, and downloads and sends nothing", async () => {
  const h = harness({ outcome: "would_transcribe", durationSeconds: 754, costUsd: 0.075 });
  assert.deepEqual(await h.transcriber.importVideo(entry, true),
    { outcome: "would transcribe", reason: "12:34, about $0.08", title: "", seconds: 754, costUsd: 0.075 });
  assert.deepEqual(h.downloads, []);
  assert.deepEqual(h.calls, [["quote", entry.url]]);
});

test("a video already in the library is reported, with nothing downloaded", async () => {
  const h = harness({ outcome: "already_imported", title: "Noticias" });
  assert.deepEqual(await h.transcriber.importVideo(entry, false), { outcome: "already imported", reason: "", title: "Noticias" });
  assert.deepEqual(h.downloads, []);
});

for (const outcome of ["too_long", "over_budget", "unknown_length"]) {
  test(`a ${outcome.replace("_", " ")} video is skipped with the backend's reason, with nothing downloaded`, async () => {
    const h = harness({ outcome, message: "the reason" });
    assert.deepEqual(await h.transcriber.importVideo(entry, false), { outcome: "skipped", reason: "the reason", title: "" });
    assert.deepEqual(h.downloads, []);
    assert.equal(h.calls.some(([what]) => what === "transcribe"), false);
  });
}

test("an audio download that fails is reported failed and nothing is sent", async () => {
  const h = harness({ outcome: "would_transcribe", durationSeconds: 60, costUsd: 0.006 },
    { download: async () => ({ error: "ERROR: Private video" }) });
  assert.deepEqual(await h.transcriber.importVideo(entry, false),
    { outcome: "failed", reason: "audio download failed: ERROR: Private video", title: "" });
  assert.equal(h.calls.some(([what]) => what === "transcribe"), false);
});

test("a stop from the backend (say transcription switched off) stops the run", async () => {
  const h = harness(new Fatal("transcription is switched off on the backend"));
  await assert.rejects(h.transcriber.importVideo(entry, false), Fatal);
});
