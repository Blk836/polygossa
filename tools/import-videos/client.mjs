import { videoId } from "./list.mjs";

export class Fatal extends Error {}

const HEADER = "X-Curator-Token";

const ERRORS = {
  no_captions: ["skipped", "no captions: "],
  not_shareable: ["refused", ""],
  review_unavailable: ["failed", "review unavailable: "],
};

const NOT_ON_SOURCE = "not_on_source";

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
    async options() {
      const { status, body } = await call("/api/curator/options");
      if (status !== 200 || !Array.isArray(body.languages) || !Array.isArray(body.categories)) {
        throw fatal(`could not read the backend's options (HTTP ${status})`);
      }
      return { languages: body.languages, categories: body.categories };
    },

    async importVideo(entry, dryRun) {
      const request = { url: entry.url, language: entry.language, dryRun };
      if (entry.category) {
        request.category = entry.category;
      }
      return post("/api/curator/videos", request);
    },

    async exportVideo(entry) {
      const path = `/api/curator/videos/${videoId(entry.url)}/copy?language=${encodeURIComponent(entry.language)}`;
      const { status, body } = await call(path);
      if (status === 200) {
        return { video: body };
      }
      return status === 404 ? { missing: body.message ?? "" } : { failed: body.message ?? `HTTP ${status}` };
    },

    async savePlaylist(request) {
      return call("/api/curator/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
    },

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
