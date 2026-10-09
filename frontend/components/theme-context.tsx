"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { themeAttribute, themeCookie, type ThemePref } from "@/lib/theme";

interface ThemeState {
  theme: ThemePref;
  setTheme: (theme: ThemePref) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

export function ThemeProvider({ initial, children }: { initial: ThemePref; children: ReactNode }) {
  const [theme, setThemeState] = useState(initial);

  const setTheme = useCallback((next: ThemePref) => {
    document.cookie = themeCookie(next);
    const attr = themeAttribute(next);
    if (attr) document.documentElement.dataset.theme = attr;
    else delete document.documentElement.dataset.theme;
    setThemeState(next);
  }, []);

  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
