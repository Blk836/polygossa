// Light/dark preference: "system" follows the OS; an explicit choice is kept in a cookie so the server can render
// <html data-theme> on the first paint (no flash of the wrong theme).

export type ThemePref = "system" | "light" | "dark";

export const THEME_COOKIE = "lector_theme";

export const THEMES: { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function parseTheme(value: string | null | undefined): ThemePref {
  return value === "light" || value === "dark" ? value : "system";
}

/** The `data-theme` value for <html>; undefined lets the stylesheet follow the OS. */
export function themeAttribute(pref: ThemePref): "light" | "dark" | undefined {
  return pref === "system" ? undefined : pref;
}

/** A `document.cookie` assignment that stores the preference (or clears it for "system"). */
export function themeCookie(pref: ThemePref): string {
  const attrs = "Path=/; Max-Age=" + (pref === "system" ? 0 : ONE_YEAR_SECONDS) + "; SameSite=Lax";
  return `${THEME_COOKIE}=${pref === "system" ? "" : pref}; ${attrs}`;
}
