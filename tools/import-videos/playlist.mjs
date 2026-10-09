import { videoId } from "./list.mjs";

const SAID = { created: "created", updated: "updated", would_create: "would create", would_update: "would update" };

export async function makePlaylist(entries, { client, title, description, dryRun, print }) {
  entries.filter((e) => e.error).forEach((e) => print(`line ${e.line}: invalid — ${e.error} ${e.url}`));
  const usable = entries.filter((e) => !e.error);
  const languages = [...new Set(usable.map((e) => e.language))];
  if (languages.length !== 1) {
    print(usable.length === 0 ? "Stopped: no videos in the list"
      : `Stopped: a playlist is in one language; the list has ${languages.join(" and ")}`);
    return 1;
  }
  const request = { title, language: languages[0], videoIds: usable.map((e) => videoId(e.url)), dryRun };
  if (description !== undefined) {
    request.description = description;
  }
  const { status, body } = await client.savePlaylist(request);
  if (status >= 300) {
    print(`Stopped: ${body.message ?? `HTTP ${status}`}`);
    return 1;
  }
  print(`Playlist "${body.title}": ${SAID[body.outcome] ?? body.outcome}, ${body.items} videos`);
  const missing = new Set(body.missing ?? []);
  usable.filter((e) => missing.has(videoId(e.url)))
    .forEach((e) => print(`Left out (not in the community library): line ${e.line} ${e.url}`));
  return 0;
}
