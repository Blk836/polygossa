import { describe, expect, it } from "vitest";
import { THEME_COOKIE, THEMES, parseTheme, themeAttribute, themeCookie } from "./theme";

describe("parseTheme", () => {
  it("accepts the three preferences", () => {
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("system")).toBe("system");
  });

  it("falls back to system for missing or unknown values", () => {
    expect(parseTheme(undefined)).toBe("system");
    expect(parseTheme(null)).toBe("system");
    expect(parseTheme("")).toBe("system");
    expect(parseTheme("DARK")).toBe("system");
    expect(parseTheme("sepia")).toBe("system");
    expect(parseTheme("toString")).toBe("system");
  });
});

describe("themeAttribute", () => {
  it("forces light or dark, and leaves system to the OS", () => {
    expect(themeAttribute("light")).toBe("light");
    expect(themeAttribute("dark")).toBe("dark");
    expect(themeAttribute("system")).toBeUndefined();
  });
});

describe("THEME_COOKIE", () => {
  it("keeps its name, so preferences already saved in browsers still apply", () => {
    expect(THEME_COOKIE).toBe("lector_theme");
  });
});

describe("themeCookie", () => {
  it("remembers an explicit choice for a year, site-wide", () => {
    expect(themeCookie("dark")).toBe(`${THEME_COOKIE}=dark; Path=/; Max-Age=31536000; SameSite=Lax`);
    expect(themeCookie("light")).toBe(`${THEME_COOKIE}=light; Path=/; Max-Age=31536000; SameSite=Lax`);
  });

  it("clears the cookie when going back to the system setting", () => {
    expect(themeCookie("system")).toBe(`${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
  });
});

describe("THEMES", () => {
  it("lists every preference once, system first", () => {
    expect(THEMES.map((t) => t.value)).toEqual(["system", "light", "dark"]);
    expect(THEMES.every((t) => t.label.length > 0)).toBe(true);
  });
});
