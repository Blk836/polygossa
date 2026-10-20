import { videoId } from "./list.mjs";

export class Fatal extends Error {}

const HEADER = "X-Curator-Token";

const ERRORS = {
  no_captions: ["skipped", "no captions: "],
  not_shareable: ["refused", ""],
  review_unavailable: ["failed", "review unavailable: "],
  no_speech: ["skipped", ""],
};

const NOT_ON_SOURCE = "not_on_source";
const TRANSCRIPTION_OFF = "transcription_off";

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
    if (body.code === TRANSCRIPTION_OFF) {
      throw fatal(body.message);
    }
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

    async quoteTranscription(entry, durationSeconds) {
      const { status, body } = await call("/api/curator/transcriptions/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: entry.url, language: entry.language, durationSeconds }),
      });
      return status === 200 ? body : { outcome: "failed", message: body.message ?? `HTTP ${status}` };
    },

    async transcribe(entry, audio, durationSeconds) {
      const form = new FormData();
      form.append("url", entry.url);
      form.append("language", entry.language);
      if (entry.category) {
        form.append("category", entry.category);
      }
      if (durationSeconds) {
        form.append("durationSeconds", String(durationSeconds));
      }
      form.append("audio", new Blob([audio.bytes]), audio.filename);
      const { status, body } = await call("/api/curator/transcriptions", { method: "POST", body: form });
      if (status === 200) {
        return { outcome: "skipped", reason: body.message ?? body.outcome, title: "" };
      }
      return status < 300 ? success(body) : failure(status, body);
    },
  };
}

function success(body) {
  const placed = body.outcome === "imported" || body.outcome === "transcribed";
  return { outcome: body.outcome.replace("_", " "), reason: placed ? body.category : "",
    title: body.title ?? "" };
}

function failure(status, body) {
  const [outcome, prefix] = ERRORS[body.code] ?? ["failed", ""];
  return { outcome, reason: prefix + (body.message ?? `HTTP ${status}`), title: "" };
}
