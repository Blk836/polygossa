export type Follow = "word" | "both" | "sentence";

export type TextWidth = "standard" | "wide" | "full";

export type VideoLayout = "beside" | "mini";

export type ReaderView = "pages" | "sentences";

export interface ReaderSettings {
  size: number;
  quiet: boolean;
  pauseOnLookup: boolean;
  pageKnown: boolean;
  follow: Follow;
  width: TextWidth;
  video: VideoLayout;
  tucked: boolean;
  view: ReaderView;
  pauseEach: boolean;
}

export const READER_SETTINGS_COOKIE = "lector_reader";
export const TEXT_SIZES = 4;
export const DEFAULT_READER_SETTINGS: ReaderSettings = { size: 1, quiet: false, pauseOnLookup: true, pageKnown: true, follow: "word", width: "wide", video: "beside", tucked: false, view: "pages", pauseEach: false };

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function flag(value: string | null, fallback: boolean): boolean | null {
  if (value === null) return fallback;
  if (value === "1") return true;
  return value === "0" ? false : null;
}

const FOLLOWS: Follow[] = ["word", "both", "sentence"];

function follow(value: string | null, legacyWord: string | null): Follow | null {
  if (value !== null) return FOLLOWS.find((f) => f === value) ?? null;
  const word = flag(legacyWord, true);
  if (word === null) return null;
  return word ? DEFAULT_READER_SETTINGS.follow : "sentence";
}

export function followsWord(follow: Follow): boolean {
  return follow !== "sentence";
}

export function followsSentence(follow: Follow): boolean {
  return follow !== "word";
}

function oneOf<T extends string>(value: string | null, choices: readonly T[], fallback: T): T | null {
  if (value === null) return fallback;
  return choices.find((c) => c === value) ?? null;
}

const WIDTHS: TextWidth[] = ["standard", "wide", "full"];
const VIDEO_LAYOUTS: VideoLayout[] = ["beside", "mini"];
const VIEWS: ReaderView[] = ["pages", "sentences"];

function size(value: string | null): number | null {
  if (value === null) return DEFAULT_READER_SETTINGS.size;
  return /^\d$/.test(value) && Number(value) < TEXT_SIZES ? Number(value) : null;
}

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
    tucked: flag(params.get("tuck"), d.tucked),
    view: oneOf(params.get("view"), VIEWS, d.view),
    pauseEach: flag(params.get("each"), d.pauseEach),
  };
  return Object.values(parsed).includes(null) ? DEFAULT_READER_SETTINGS : (parsed as ReaderSettings);
}

const COOKIE_KEYS: [keyof ReaderSettings, string, (s: ReaderSettings) => string][] = [
  ["size", "size", (s) => String(s.size)],
  ["quiet", "quiet", () => "1"],
  ["pauseOnLookup", "pause", () => "0"],
  ["pageKnown", "known", () => "0"],
  ["follow", "follow", (s) => s.follow],
  ["width", "width", (s) => s.width],
  ["video", "video", (s) => s.video],
  ["tucked", "tuck", () => "1"],
  ["view", "view", (s) => s.view],
  ["pauseEach", "each", () => "1"],
];

export function readerSettingsCookie(settings: ReaderSettings): string {
  const params = new URLSearchParams();
  for (const [field, key, value] of COOKIE_KEYS) if (settings[field] !== DEFAULT_READER_SETTINGS[field]) params.set(key, value(settings));
  const value = params.toString();
  const maxAge = value ? ONE_YEAR_SECONDS : 0;
  return `${READER_SETTINGS_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
