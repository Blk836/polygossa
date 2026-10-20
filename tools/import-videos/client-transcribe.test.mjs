import { test } from "node:test";
import assert from "node:assert/strict";
import { Fatal, makeClient } from "./client.mjs";

const entry = { line: 3, url: "https://youtu.be/AAAAAAAAAAA", language: "es", category: "news" };
const AUDIO = { bytes: Buffer.from("opus-bytes"), filename: "audio.webm" };

function fakeFetch(status, body) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init });
    return new Response(body === undefined ? "" : JSON.stringify(body), { status });
  };
  return { fetch, calls };
}

const client = (fetch) => makeClient({ baseUrl: "http://localhost:8080", token: "s3cret", fetch });

test("a quote is asked for as JSON with the token, and answered as the backend gave it", async () => {
  const quote = { outcome: "would_transcribe", videoId: "AAAAAAAAAAA", durationSeconds: 600, costUsd: 0.06 };
  const { fetch, calls } = fakeFetch(200, quote);
  assert.deepEqual(await client(fetch).quoteTranscription(entry), quote);
  assert.equal(calls[0].url, "http://localhost:8080/api/curator/transcriptions/quote");
  assert.equal(calls[0].init.headers["X-Curator-Token"], "s3cret");
  assert.deepEqual(JSON.parse(calls[0].init.body), { url: entry.url, language: "es" });
});

test("transcription switched off on the backend stops the run", async () => {
  const { fetch } = fakeFetch(503, { code: "transcription_off", message: "transcription is switched off on the backend: start it with OPENAI_API_KEY set" });
  await assert.rejects(client(fetch).quoteTranscription(entry),
    (error) => error instanceof Fatal && /transcription is switched off on the backend/.test(error.message));
});

test("another quote failure is a failed line", async () => {
  const { fetch } = fakeFetch(500, undefined);
  assert.deepEqual(await client(fetch).quoteTranscription(entry), { outcome: "failed", message: "HTTP 500" });
});

test("the audio is sent as a form with the video's details", async () => {
  const { fetch, calls } = fakeFetch(201, { outcome: "transcribed", title: "Noticias", category: "news" });
  assert.deepEqual(await client(fetch).transcribe(entry, AUDIO), { outcome: "transcribed", reason: "news", title: "Noticias" });
  assert.equal(calls[0].url, "http://localhost:8080/api/curator/transcriptions");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers["X-Curator-Token"], "s3cret");
  const form = calls[0].init.body;
  assert.equal(form.get("url"), entry.url);
  assert.equal(form.get("language"), "es");
  assert.equal(form.get("category"), "news");
  assert.equal(form.get("audio").name, "audio.webm");
  assert.equal(Buffer.from(await form.get("audio").arrayBuffer()).toString(), "opus-bytes");
});

const cases = [
  [422, { code: "no_speech", message: "no speech found" }, { outcome: "skipped", reason: "no speech found", title: "" }],
  [422, { code: "no_speech", message: "the speech is English, not Spanish" }, { outcome: "skipped", reason: "the speech is English, not Spanish", title: "" }],
  [502, { code: "ai_error", message: "The transcription service is unavailable right now" }, { outcome: "failed", reason: "The transcription service is unavailable right now", title: "" }],
  [400, { code: "audio_too_big", message: "the audio is 30.0 MB, over Whisper's 25 MB limit" }, { outcome: "failed", reason: "the audio is 30.0 MB, over Whisper's 25 MB limit", title: "" }],
  [200, { outcome: "over_budget", message: "transcription budget used up" }, { outcome: "skipped", reason: "transcription budget used up", title: "" }],
];

for (const [status, body, expected] of cases) {
  test(`a transcription answered ${status} ${body.code ?? body.outcome} is "${expected.outcome}"`, async () => {
    const { fetch } = fakeFetch(status, body);
    assert.deepEqual(await client(fetch).transcribe(entry, AUDIO), expected);
  });
}
