"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TEXT_SIZES, type ReaderSettings } from "./reader-settings";

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
        className={`rounded px-2 py-1 text-xs ${open ? "bg-accent-soft" : "text-muted hover:bg-paper"}`}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={label}
        title={label}
      >
        {button}
      </button>
      {open && (
        <div role="dialog" aria-label={label} className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-line bg-card p-4 text-sm shadow-lg">
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
