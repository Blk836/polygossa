"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TEXT_SIZES, type Follow, type ReaderSettings, type TextWidth } from "./reader-settings";

/** The reader header's tool buttons: round, quiet until hovered. */
export const toolButton = "flex size-8 items-center justify-center rounded-full text-sm text-muted transition-colors hover:bg-card hover:text-ink";

/** A button that opens a small panel below it; Escape or a click outside closes it. */
function Menu({ label, button, children }: { label: string; button: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div ref={root} className="relative">
      <button
        className={`${toolButton} ${open ? "bg-accent-soft text-ink" : ""}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {button}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute right-0 z-30 mt-2 w-80 rounded-xl border border-line bg-card p-4 text-sm shadow-lg">
          {children}
        </div>
      )}
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1.5">
      <input type="checkbox" className="mt-1 accent-[var(--accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
    </label>
  );
}

const sizeButton = "rounded border border-line px-2 py-0.5 hover:bg-paper disabled:opacity-40";

const WIDTHS: { value: TextWidth; label: string }[] = [
  { value: "standard", label: "Standard" },
  { value: "wide", label: "Wide" },
  { value: "full", label: "Full" },
];

/** Standard (a book-like column), Wide or Full: how many words fit on a line on a big screen. */
function TextWidthPicker({ value, onChange }: { value: TextWidth; onChange: (width: TextWidth) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span id="reader-text-width">Text width</span>
      <div role="radiogroup" aria-labelledby="reader-text-width" className="inline-flex rounded-lg border border-line bg-paper p-0.5 text-xs">
        {WIDTHS.map((w) => (
          <button
            key={w.value}
            type="button"
            role="radio"
            aria-checked={value === w.value}
            onClick={() => onChange(w.value)}
            className={`rounded-md px-2.5 py-1 transition ${value === w.value ? "bg-card font-medium text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"}`}
          >
            {w.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SettingsMenu({ settings, onChange }: { settings: ReaderSettings; onChange: (change: Partial<ReaderSettings>) => void }) {
  return (
    <Menu label="Reader settings" button={<span aria-hidden>Aa</span>}>
      <div className="flex items-center justify-between pb-2">
        <span>Text size</span>
        <span className="flex gap-1">
          <button className={sizeButton} onClick={() => onChange({ size: settings.size - 1 })} disabled={settings.size <= 0} aria-label="Smaller text">A−</button>
          <button className={sizeButton} onClick={() => onChange({ size: settings.size + 1 })} disabled={settings.size >= TEXT_SIZES - 1} aria-label="Larger text">A+</button>
        </span>
      </div>
      <TextWidthPicker value={settings.width} onChange={(width) => onChange({ width })} />
      <Toggle label="Quiet colours" hint="Hide new-word highlighting." checked={settings.quiet} onChange={(quiet) => onChange({ quiet })} />
      <Toggle
        label="Pause when looking up a word"
        hint="Audio and video pause while the word card is open."
        checked={settings.pauseOnLookup}
        onChange={(pauseOnLookup) => onChange({ pauseOnLookup })}
      />
      <Toggle
        label="Turning the page marks new words known"
        hint="Words you didn't click on a page become known when you go to the next one."
        checked={settings.pageKnown}
        onChange={(pageKnown) => onChange({ pageKnown })}
      />
      <label className="flex items-start justify-between gap-3 py-1.5">
        <span>
          <span className="block">Follow along</span>
          <span className="block text-xs text-muted">What playback marks as it goes.</span>
        </span>
        <select
          className="rounded border border-line bg-card px-1.5 py-0.5"
          value={settings.follow}
          onChange={(e) => onChange({ follow: e.target.value as Follow })}
        >
          <option value="word">Word</option>
          <option value="both">Word and sentence</option>
          <option value="sentence">Sentence</option>
        </select>
      </label>
    </Menu>
  );
}

const SHORTCUTS: [string, string][] = [
  ["Click a word", "Look it up"],
  ["Drag / Shift-click", "Select a phrase"],
  ["L or 1", "Mark learning"],
  ["K", "Mark known"],
  ["I", "Ignore"],
  ["X", "Remove status"],
  ["← →", "Previous / next word (with a word open), else page"],
  ["Esc", "Close the word card"],
];

const MEDIA_SHORTCUTS: [string, string][] = [
  ["Space", "Play / pause"],
  ["R", "Replay sentence"],
  ["[ ]", "Previous / next sentence"],
];

export function ShortcutsMenu({ media }: { media: boolean }) {
  const rows = media ? [...SHORTCUTS, ...MEDIA_SHORTCUTS] : SHORTCUTS;
  return (
    <Menu label="Keyboard shortcuts" button={<span aria-hidden>?</span>}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map(([keys, action]) => (
          <div key={keys} className="contents">
            <dt><kbd className="rounded border border-line bg-paper px-1.5 py-0.5 text-xs">{keys}</kbd></dt>
            <dd className="text-muted">{action}</dd>
          </div>
        ))}
      </dl>
    </Menu>
  );
}
