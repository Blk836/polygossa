// Reader preferences: text size, quiet colours, pausing playback on lookup, whether turning the page marks its new
// words known, and whether playback marks the spoken word as well as its sentence. Kept in a cookie, like the theme, so the server renders the chosen text size on the first paint.

export interface ReaderSettings {
  /** Index into the reader's text sizes. */
  size: number;
  /** Hide known and ignored word colours. */
  quiet: boolean;
  /** Pause audio or video when a word is looked up. */
  pauseOnLookup: boolean;
  /** Turning to the next page marks the words on it that have no status as known (as in LingQ). */
  pageKnown: boolean;
  /** Follow along: mark the spoken word under its tinted sentence (else the sentence only). */
  followWord: boolean;
}

export const READER_SETTINGS_COOKIE = "lector_reader";
export const TEXT_SIZES = 4;
export const DEFAULT_READER_SETTINGS: ReaderSettings = { size: 1, quiet: false, pauseOnLookup: true, pageKnown: true, followWord: true };

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

function flag(value: string | null, fallback: boolean): boolean | null {
  if (value === null) return fallback;
  if (value === "1") return true;
  return value === "0" ? false : null;
}

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
    followWord: flag(params.get("word"), d.followWord),
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
  if (settings.followWord !== d.followWord) params.set("word", "0");
  const value = params.toString();
  const maxAge = value ? ONE_YEAR_SECONDS : 0;
  return `${READER_SETTINGS_COOKIE}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}
