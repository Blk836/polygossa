"use client";

import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { LANGUAGES, languageInfo } from "@/lib/languages";
import type { LanguageCode, Me } from "@/lib/types";
import { useMe } from "./me-context";
import { useDismiss } from "./use-dismiss";

/** The language being studied right now. Library, Explore, Words and Review all show this language only. Plain like
 * the counters beside it: their soft pill shows only on hover or while the menu is open. */
export function LanguageSwitcher() {
  const { me, setMe } = useMe();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = me.targetLanguage ? languageInfo(me.targetLanguage) : undefined;

  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, root);

  async function choose(code: LanguageCode) {
    setOpen(false);
    if (code === me.targetLanguage) return;
    setBusy(true);
    try {
      setMe(await api<Me>("me", { method: "PATCH", body: { targetLanguage: code } }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Studying ${current?.name ?? "no language yet"}. Change language`}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm transition hover:bg-card aria-expanded:bg-card disabled:opacity-60"
      >
        <span className="grid h-5 min-w-6 place-items-center rounded-md bg-rubric px-1 text-[10px] font-bold tracking-wide text-paper uppercase">
          {current?.code ?? "?"}
        </span>
        <span className="hidden font-semibold sm:inline">{current?.native ?? "Choose language"}</span>
        <svg viewBox="0 0 12 12" className="size-3 text-muted" aria-hidden><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
      </button>
      {open && (
        <div role="menu" aria-label="Language" className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg">
          <p className="px-3 pt-2 pb-1 text-xs font-medium tracking-wide text-muted uppercase">I&apos;m learning</p>
          {LANGUAGES.map((l) => {
            const selected = l.code === me.targetLanguage;
            return (
              <button
                key={l.code}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                onClick={() => void choose(l.code)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-paper ${selected ? "font-medium" : ""}`}
              >
                <span className={`grid h-6 min-w-7 place-items-center rounded-md px-1 text-[11px] font-bold uppercase ${selected ? "bg-rubric text-paper" : "bg-paper text-muted"}`}>
                  {l.code}
                </span>
                <span className="flex-1">{l.native}<span className="ml-1.5 text-xs text-muted">{l.name}</span></span>
                {selected && <span className="text-rubric" aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
