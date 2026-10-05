"use client";

import { THEMES } from "@/lib/theme";
import { useTheme } from "./theme-context";

/** Light / dark / system switch; applies at once and is remembered on this device. */
export function ThemePicker() {
  const { theme, setTheme } = useTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-line bg-paper p-1 text-sm">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          role="radio"
          aria-checked={theme === t.value}
          onClick={() => setTheme(t.value)}
          className={`rounded-md px-4 py-1.5 transition ${
            theme === t.value ? "bg-card font-medium text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
