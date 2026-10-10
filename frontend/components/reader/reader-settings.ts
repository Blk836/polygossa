export type Follow = "word" | "both" | "sentence";

export type TextWidth = "standard" | "wide" | "full";

export type VideoLayout = "beside" | "mini";

export interface ReaderSettings {
  size: number;
  quiet: boolean;
  pauseOnLookup: boolean;
  pageKnown: boolean;
  follow: Follow;
  width: TextWidth;
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
  };
  return Object.values(parsed).includes(null) ? DEFAULT_READER_SETTINGS : (parsed as ReaderSettings);
}

export function readerSettingsCookie(settings: ReaderSettings): string {
  const d = DEFAULT_READER_SETTINGS;
  const params = new URLSearchParams();
  if (settings.size !== d.size) params.set("size", String(settings.size));
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
