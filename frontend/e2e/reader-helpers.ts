import { expect, test, type Page } from "@playwright/test";

export const PER_SENTENCE = 10;
export const PAGE = 250;
export const TALL = { width: 1280, height: 3000 };

export function letters(i: number): string {
  let s = "";
  for (let n = i; ; n = Math.floor(n / 26) - 1) {
    s = String.fromCharCode(97 + (n % 26)) + s;
    if (n < 26) break;
  }
  return s;
}

export interface Created {
  id: number;
  language: string;
  prefix: string;
  word: (n: number) => string;
}

function wordsFor(prefix: string) {
  return (i: number) => (i % PER_SENTENCE === 0 ? `${prefix}qorvex` : `${prefix}${letters(i)}`);
}

export function transcript(word: (n: number) => string, words: number): string[] {
  const sentences: string[] = [];
  for (let start = 0; start < words; start += PER_SENTENCE) {
    const end = Math.min(words, start + PER_SENTENCE);
    sentences.push(Array.from({ length: end - start }, (_, k) => word(start + k)).join(" ") + ".");
  }
  return sentences;
}

async function setUp(page: Page) {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const prefix = `z${letters(Math.floor(Math.random() * 26 ** 4))}x`;
  return { language: (me.targetLanguage ?? "es") as string, prefix, word: wordsFor(prefix) };
}

export async function createText(page: Page, words = 1000): Promise<Created> {
  const base = await setUp(page);
  const res = await page.request.post("/api/texts", {
    data: { title: `Reader check ${base.prefix}`, language: base.language, content: transcript(base.word, words).join(" "), isPublic: false, category: "other" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return { ...base, id: (await res.json()).id };
}

export async function createTextWith(page: Page, content: (word: (n: number) => string) => string): Promise<Created> {
  const base = await setUp(page);
  const res = await page.request.post("/api/texts", {
    data: { title: `Reader check ${base.prefix}`, language: base.language, content: content(base.word), isPublic: false, category: "other" },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return { ...base, id: (await res.json()).id };
}

function srtTime(ms: number): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(Math.floor(ms / 3_600_000))}:${pad(Math.floor(ms / 60_000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
}

export async function createVideo(page: Page, words = 1000): Promise<Created> {
  const base = await setUp(page);
  const srt = transcript(base.word, words)
    .map((line, k) => `${k + 1}\n${srtTime(k * 3000)} --> ${srtTime(k * 3000 + 3000)}\n${line}\n`)
    .join("\n");
  const res = await page.request.post("/api/texts/import-youtube", {
    multipart: {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      language: base.language,
      title: `Video check ${base.prefix}`,
      file: { name: "transcript.srt", mimeType: "text/plain", buffer: Buffer.from(srt) },
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return { ...base, id: (await res.json()).id };
}

export async function cleanUp(page: Page, created: Created | null) {
  if (!created) return;
  for (;;) {
    const found = await (await page.request.get(`/api/vocabulary?language=${created.language}&q=${created.prefix}&size=200`)).json();
    const items = (found.items ?? []) as { id: number; term: string }[];
    const mine = items.filter((e) => e.term.startsWith(created.prefix));
    if (mine.length === 0) break;
    const res = await page.request.post("/api/vocabulary/delete", { data: { ids: mine.map((e) => e.id) } });
    expect(res.ok(), await res.text()).toBe(true);
  }
  await page.request.delete(`/api/texts/${created.id}`);
}

export async function openReader(page: Page, path: string) {
  const session = page.waitForResponse((r) => r.url().endsWith("/api/sessions") && r.request().method() === "POST");
  await page.goto(path);
  await session;
}

export async function setReaderCookie(page: Page, value: string) {
  await page.context().addCookies([{ name: "lector_reader", value, url: test.info().project.use.baseURL }]);
}

export const pager = (page: Page) => page.getByRole("navigation", { name: "Pages" }).first();
export const bottomPager = (page: Page) => page.getByRole("navigation", { name: "Pages" }).last();
export const article = (page: Page) => page.locator("article");
export const wordAt = (page: Page, n: number) => article(page).locator(`[data-i="${2 * n}"]`);
export const player = (page: Page) => page.getByRole("region", { name: "Player" });
export const popupClose = (page: Page) => page.locator("[data-word-popup]").getByRole("button", { name: "Close", exact: true });

export function silentWav(seconds: number): Buffer {
  const rate = 8000;
  const data = rate * seconds;
  const b = Buffer.alloc(44 + data, 0x80);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + data, 4);
  b.write("WAVEfmt ", 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(data, 40);
  return b;
}

export async function addSyncedAudio(page: Page, id: number, seconds = 60) {
  const upload = await page.request.post(`/api/texts/${id}/audio`, {
    multipart: { file: { name: "silence.wav", mimeType: "audio/wav", buffer: silentWav(seconds) } },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const align = await page.request.post(`/api/texts/${id}/timings/auto`, { data: { durationMs: seconds * 1000 } });
  expect(align.ok(), await align.text()).toBe(true);
}

const FAKE_YOUTUBE = `
window.__players = 0;
window.YT = { Player: class {
  constructor(el, o) {
    window.__players++;
    const frame = document.createElement("iframe");
    frame.style.width = "100%"; frame.style.height = "100%"; frame.style.border = "0";
    el.replaceWith(frame);
    window.__frame = frame;
    setTimeout(() => o.events.onReady({ target: this }));
  }
  playVideo() {} pauseVideo() {} seekTo() {}
  getCurrentTime() { return 0; }
  getDuration() { return 600; }
  setPlaybackRate() {} destroy() {}
} };
window.onYouTubeIframeAPIReady?.();
`;
export const fakeYouTube = (page: Page) =>
  page.route("https://www.youtube.com/iframe_api", (route) => route.fulfill({ contentType: "text/javascript", body: FAKE_YOUTUBE }));

