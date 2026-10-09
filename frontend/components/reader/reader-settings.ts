// Reader preferences: text size and width, quiet colours, pausing playback on lookup, whether turning the page marks
// its new words known, what playback marks as it goes (the spoken word, its sentence, or both), and where a video
// sits. Kept in a cookie, like the theme, so the server renders the chosen layout on the first paint.

/** What playback marks: the spoken word, the word and its sentence, or the sentence only. */
export type Follow = "word" | "both" | "sentence";

/** How wide the text column may grow: a book-like column, a wide one (the default), or the whole window. */
export type TextWidth = "standard" | "wide" | "full";

/** Where a video sits on wide screens: beside the text, or in a small player floating in the corner. */
export type VideoLayout = "beside" | "mini";

export interface ReaderSettings {
  /** Index into the reader's text sizes. */
  size: number;
  /** Hide known and ignored word colours. */
  quiet: boolean;
  /** Pause audio or video when a word is looked up. */
  pauseOnLookup: boolean;
  /** Turning to the next page marks the words on it that have no status as known (as in LingQ). */
  pageKnown: boolean;
  /** Follow along: underline the spoken word (the default), also tint its sentence, or tint the sentence only. */
  follow: Follow;
  /** How wide the text column may grow. */
  width: TextWidth;
  /** Where a video sits on wide screens (phones always show it above the text). */
  video: VideoLayout;
}

export const READER_SETTINGS_COOKIE = "lector_reader";
export const TEXT_SIZES = 4;
export const DEFAULT_READER_SETTINGS: ReaderSettings = { size: 1, quiet: false, pauseOnLookup: true, pageKnown: true, follow: "word", width: "wide", video: "beside" };

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function flag(value: string | null, fallback: boolean): boolean | null {
  if (value === null) return fallback;
  if (value === "1") return true;
  return value === "0" ? false : null;
}

const FOLLOWS: Follow[] = ["word", "both", "sentence"];

/** `follow` is the stored choice; `word=0` is how "Sentence" was stored while the default was word and sentence. */
function follow(value: string | null, legacyWord: string | null): Follow | null {
  if (value !== null) return FOLLOWS.find((f) => f === value) ?? null;
  const word = flag(legacyWord, true);
  if (word === null) return null;
  return word ? DEFAULT_READER_SETTINGS.follow : "sentence";
}

/** Whether playback underlines the spoken word. */
export function followsWord(follow: Follow): boolean {
  return follow !== "sentence";
}

/** Whether playback tints the spoken sentence. */
export function followsSentence(follow: Follow): boolean {
  return follow !== "word";
}

/** One of `choices`; absent means the default (settings saved before it existed), anything else is malformed. */
function oneOf<T extends string>(value: string | null, choices: readonly T[], fallback: T): T | null {
  if (value === null) return fallback;
  return choices.find((c) => c === value) ?? null;
}

const WIDTHS: TextWidth[] = ["standard", "wide", "full"];
const VIDEO_LAYOUTS: VideoLayout[] = ["beside", "mini"];

function size(value: string | null): number | null {
  if (value === null) return DEFAULT_READER_SETTINGS.size;
  return /^\d$/.test(value) && Number(value) < TEXT_SIZES ? Number(value) : null;
}

/** Reads the cookie value; anything malformed means the defaults. */
export function parseReaderSettings(value: string | null | undefined): ReaderSettings {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(decodeURIComponent(value ?? ""));
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
  const d = DEFAULT_READER_SETTINGS;
  const parsed = {
    size: size(params.get("size")),
    quiet: flag(params.get("quiet"), d.quiet),
    pauseOnLookup: flag(params.get("pause"), d.pauseOnLookup),
    pageKnown: flag(params.get("known"), d.pageKnown),
    follow: follow(params.get("follow"), params.get("word")),
    width: oneOf(params.get("width"), WIDTHS, d.width),
    video: oneOf(params.get("video"), VIDEO_LAYOUTS, d.video),
  };
  return Object.values(parsed).includes(null) ? DEFAULT_READER_SETTINGS : (parsed as ReaderSettings);
}

/** A `document.cookie` assignment that stores what differs from the defaults (or clears the cookie). */
export function readerSettingsCookie(settings: ReaderSettings): string {
  const d = DEFAULT_READER_SETTINGS;
  const params = new URLSearchParams();
  if (settings.size !== d.size) params.set("size", String(settings.size));
  // Each flag is only stored when it differs from its default, so it is stored as the opposite of the default.
  if (settings.quiet !== d.quiet) params.set("quiet", "1");
  if (settings.pauseOnLookup !== d.pauseOnLookup) params.set("pause", "0");
  if (settings.pageKnown !== d.pageKnown) params.set("known", "0");
  if (settings.follow !== d.follow) params.set("follow", settings.follow);
  if (settings.width !== d.width) params.set("width", settings.width);
  if (settings.video !== d.video) params.set("video", settings.video);
  const value = params.toString();
  const maxAge = value ? ONE_YEAR_SECONDS : 0;
  return `${READER_SETTINGS_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
