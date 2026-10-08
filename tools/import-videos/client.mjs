// Talks to the backend's curator endpoints and turns each answer into an outcome for the report.

import { videoId } from "./list.mjs";

/** An error that stops the whole run (the backend can't be used at all), as opposed to one video failing. */
export class Fatal extends Error {}

const HEADER = "X-Curator-Token";

/** Backend error codes that aren't plain failures: [outcome, prefix for the message]. */
const ERRORS = {
  no_captions: ["skipped", "no captions: "],
  not_shareable: ["refused", ""],
  review_unavailable: ["failed", "review unavailable: "],
};

/** The source's answer when it has no copy of a video: one line's problem, not the backend switched off. */
const NOT_ON_SOURCE = "not_on_source";

/** `label` ("source", "target") starts the messages that stop a run, when there are two backends. */
export function makeClient({ baseUrl, token, fetch = globalThis.fetch, label = null }) {
  const base = baseUrl.replace(/\/+$/, "");
  const fatal = (message) => new Fatal(label ? `${label}: ${message}` : message);

  async function call(path, init = {}) {
    let response;
    try {
      response = await fetch(base + path, { ...init, headers: { ...init.headers, [HEADER]: token } });
    } catch {
      throw fatal(`backend not reachable at ${base}`);
    }
    if (response.status === 401) {
      throw fatal("curator token rejected");
    }
    const body = await response.json().catch(() => ({}));
    if (response.status === 404 && body.code !== NOT_ON_SOURCE) {
      throw fatal("bulk import is off on the backend: start it with CURATOR_TOKEN set");
    }
    return { status: response.status, body };
  }

  async function post(path, request) {
    const { status, body } = await call(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    return status < 300 ? success(body) : failure(status, body);
  }

  return {
    /** The language and category codes the backend accepts. */
    async options() {
      const { status, body } = await call("/api/curator/options");
      if (status !== 200 || !Array.isArray(body.languages) || !Array.isArray(body.categories)) {
        throw fatal(`could not read the backend's options (HTTP ${status})`);
      }
      return { languages: body.languages, categories: body.categories };
    },

    /** Imports one list entry (or, in a dry run, asks whether it would be); returns {outcome, reason, title}. */
    async importVideo(entry, dryRun) {
      const request = { url: entry.url, language: entry.language, dryRun };
      if (entry.category) {
        request.category = entry.category;
      }
      return post("/api/curator/videos", request);
    },

    /** A list entry's finished text on this (source) backend: {video}, or {missing} / {failed} with the reason. */
    async exportVideo(entry) {
      const path = `/api/curator/videos/${videoId(entry.url)}/copy?language=${encodeURIComponent(entry.language)}`;
      const { status, body } = await call(path);
      if (status === 200) {
        return { video: body };
      }
      return status === 404 ? { missing: body.message ?? "" } : { failed: body.message ?? `HTTP ${status}` };
    },

    /** Saves an exported video on this (target) backend; returns {outcome, reason, title} as importVideo does. */
    async copyVideo(video, dryRun) {
      return post("/api/curator/copies", { ...video, dryRun });
    },
  };
}

function success(body) {
  return { outcome: body.outcome.replace("_", " "), reason: body.outcome === "imported" ? body.category : "",
    title: body.title ?? "" };
}

function failure(status, body) {
  const [outcome, prefix] = ERRORS[body.code] ?? ["failed", ""];
  return { outcome, reason: prefix + (body.message ?? `HTTP ${status}`), title: "" };
}
