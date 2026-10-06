import { expect, test, type Page } from "@playwright/test";

// Shared by the reader specs: synthetic texts (and videos, audio) created through the API and removed afterwards.

/** Sentences are 10 words long; a 1,000-word text splits into four pages of 250. */
export const PER_SENTENCE = 10;
export const PAGE = 250;
/** A window tall enough for a full 250-word page: pages are cut to fit the window, so shorter ones hold fewer words. */
export const TALL = { width: 1280, height: 3000 };

/** Letters for a number: 0 → a, 25 → z, 26 → aa, … (digits might not tokenize as words). */
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
  /** Every word of this text starts with it, so parallel tests never share vocabulary. */
  prefix: string;
  /** The n-th word (0-based): distinct, except that every sentence starts with the same word. */
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
  await page.goto("/library"); // signs in (auto-login) and sets the session cookie used by page.request
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

/** A short text with content of the test's choosing (built from its unique words). */
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

/** A YouTube video lesson whose transcript (one cue per 3-second sentence) comes from a subtitle file. */
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

/** Deletes the text and every vocabulary entry made from its words. */
export async function cleanUp(page: Page, created: Created | null) {
  if (!created) return;
  for (;;) {
    const found = await (await page.request.get(`/api/vocabulary?language=${created.language}&q=${created.prefix}&size=200`)).json();
    const items = (found.items ?? []) as { id: number; term: string }[];
    const mine = items.filter((e) => e.term.startsWith(created.prefix));
    if (mine.length === 0) break;
    // A page turn can save hundreds of words: delete each page of them in one request.
    const res = await page.request.post("/api/vocabulary/delete", { data: { ids: mine.map((e) => e.id) } });
    expect(res.ok(), await res.text()).toBe(true);
  }
  await page.request.delete(`/api/texts/${created.id}`);
}

/** Opens the reader and waits until it has hydrated (it starts a reading session once interactive). */
export async function openReader(page: Page, path: string) {
  const session = page.waitForResponse((r) => r.url().endsWith("/api/sessions") && r.request().method() === "POST");
  await page.goto(path);
  await session;
}

/** Sets reader settings for the next page load, as the settings menu would. */
export async function setReaderCookie(page: Page, value: string) {
  await page.context().addCookies([{ name: "lector_reader", value, url: test.info().project.use.baseURL }]);
}

export const pager = (page: Page) => page.getByRole("navigation", { name: "Pages" }).first();
export const bottomPager = (page: Page) => page.getByRole("navigation", { name: "Pages" }).last();
export const article = (page: Page) => page.locator("article");
/** The n-th word of the text (0-based), as rendered in the article. */
export const wordAt = (page: Page, n: number) => article(page).locator(`[data-i="${2 * n}"]`);
export const player = (page: Page) => page.getByRole("region", { name: "Player" });
/** The word card (popup) is open. */
export const popupClose = (page: Page) => page.getByRole("button", { name: "Close", exact: true });

/** A silent mono 8 kHz 8-bit WAV of the given length. */
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

/** Uploads `seconds` of silence (a minute by default) and spreads the words over it. */
export async function addSyncedAudio(page: Page, id: number, seconds = 60) {
  const upload = await page.request.post(`/api/texts/${id}/audio`, {
    multipart: { file: { name: "silence.wav", mimeType: "audio/wav", buffer: silentWav(seconds) } },
  });
  expect(upload.ok(), await upload.text()).toBe(true);
  const align = await page.request.post(`/api/texts/${id}/timings/auto`, { data: { durationMs: seconds * 1000 } });
  expect(align.ok(), await align.text()).toBe(true);
}
