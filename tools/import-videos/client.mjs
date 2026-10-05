// Talks to the backend's curator endpoints and turns each answer into an outcome for the report.

/** An error that stops the whole run (the backend can't be used at all), as opposed to one video failing. */
export class Fatal extends Error {}

const HEADER = "X-Curator-Token";

/** Backend error codes that aren't plain failures: [outcome, prefix for the message]. */
const ERRORS = {
  no_captions: ["skipped", "no captions: "],
  not_shareable: ["refused", ""],
  review_unavailable: ["failed", "review unavailable: "],
};

export function makeClient({ baseUrl, token, fetch = globalThis.fetch }) {
  const base = baseUrl.replace(/\/+$/, "");

  async function call(path, init = {}) {
    let response;
    try {
      response = await fetch(base + path, { ...init, headers: { ...init.headers, [HEADER]: token } });
    } catch {
      throw new Fatal(`backend not reachable at ${base}`);
    }
    if (response.status === 401) {
      throw new Fatal("curator token rejected");
    }
    if (response.status === 404) {
      throw new Fatal("bulk import is off on the backend: start it with CURATOR_TOKEN set");
    }
    return { status: response.status, body: await response.json().catch(() => ({})) };
  }

  return {
    /** The language and category codes the backend accepts. */
    async options() {
      const { status, body } = await call("/api/curator/options");
      if (status !== 200 || !Array.isArray(body.languages) || !Array.isArray(body.categories)) {
        throw new Fatal(`could not read the backend's options (HTTP ${status})`);
      }
      return { languages: body.languages, categories: body.categories };
    },

    /** Imports one list entry (or, in a dry run, asks whether it would be); returns {outcome, reason, title}. */
    async importVideo(entry, dryRun) {
      const request = { url: entry.url, language: entry.language, dryRun };
      if (entry.category) {
        request.category = entry.category;
      }
      const { status, body } = await call("/api/curator/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      return status < 300 ? success(body) : failure(status, body);
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
