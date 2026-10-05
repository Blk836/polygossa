import { describe, expect, it } from "vitest";
import {
  DEFAULT_READER_SETTINGS,
  READER_SETTINGS_COOKIE,
  TEXT_SIZES,
  parseReaderSettings,
  readerSettingsCookie,
  type ReaderSettings,
} from "./reader-settings";

const custom: ReaderSettings = { size: 3, quiet: true, pauseOnLookup: false, pageKnown: false };

/** The cookie value a `document.cookie` assignment would store. */
const valueOf = (assignment: string) => assignment.slice(READER_SETTINGS_COOKIE.length + 1, assignment.indexOf(";"));

describe("parseReaderSettings", () => {
  it("returns the defaults with no cookie", () => {
    expect(parseReaderSettings(undefined)).toEqual(DEFAULT_READER_SETTINGS);
    expect(parseReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS);
    expect(parseReaderSettings("")).toEqual(DEFAULT_READER_SETTINGS);
  });

  it("has sensible defaults: medium text, colours on, pause on lookup, page turns mark known", () => {
    expect(DEFAULT_READER_SETTINGS).toEqual({ size: 1, quiet: false, pauseOnLookup: true, pageKnown: true });
  });

  it("round-trips through the cookie", () => {
    expect(parseReaderSettings(valueOf(readerSettingsCookie(custom)))).toEqual(custom);
    const one = { ...DEFAULT_READER_SETTINGS, quiet: true };
    expect(parseReaderSettings(valueOf(readerSettingsCookie(one)))).toEqual(one);
  });

  it("reads each field on its own, keeping the default for the rest", () => {
    expect(parseReaderSettings("size%3D0")).toEqual({ ...DEFAULT_READER_SETTINGS, size: 0 });
    expect(parseReaderSettings("quiet%3D1")).toEqual({ ...DEFAULT_READER_SETTINGS, quiet: true });
    expect(parseReaderSettings("pause%3D0")).toEqual({ ...DEFAULT_READER_SETTINGS, pauseOnLookup: false });
    expect(parseReaderSettings("known%3D0")).toEqual({ ...DEFAULT_READER_SETTINGS, pageKnown: false });
  });

  it("accepts every text size and ignores out-of-range or junk values", () => {
    for (let size = 0; size < TEXT_SIZES; size++) expect(parseReaderSettings(`size%3D${size}`).size).toBe(size);
    for (const bad of ["size%3D4", "size%3D-1", "size%3Dbig", "size%3D1.5", "quiet%3Dyes", "pause%3D2", "%%%", "a=b"]) {
      expect(parseReaderSettings(bad), bad).toEqual(DEFAULT_READER_SETTINGS);
    }
  });
});

describe("readerSettingsCookie", () => {
  it("stores the settings for a year on every path", () => {
    const c = readerSettingsCookie(custom);
    expect(READER_SETTINGS_COOKIE).toBe("lector_reader"); // the server reads this name
    expect(c.startsWith("lector_reader=")).toBe(true);
    expect(c).toContain("Path=/");
    expect(c).toContain(`Max-Age=${365 * 24 * 60 * 60}`);
    expect(c).toContain("SameSite=Lax");
  });

  it("clears the cookie when everything is the default", () => {
    const c = readerSettingsCookie(DEFAULT_READER_SETTINGS);
    expect(valueOf(c)).toBe("");
    expect(c).toContain("Max-Age=0");
  });

  it("only stores what differs from the default", () => {
    expect(decodeURIComponent(valueOf(readerSettingsCookie({ ...DEFAULT_READER_SETTINGS, size: 2 })))).toBe("size=2");
    expect(decodeURIComponent(valueOf(readerSettingsCookie(custom)))).toBe("size=3&quiet=1&pause=0&known=0");
  });

  it("produces a value that is safe in a cookie", () => {
    expect(valueOf(readerSettingsCookie(custom))).toMatch(/^[A-Za-z0-9%._-]*$/);
  });
});
