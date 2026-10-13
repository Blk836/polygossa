"use client";

import { useId, useRef, useState } from "react";
import { api, errorMessage } from "@/lib/api";
import { finishedSummary, markFinishedLabel, markFinishedMessage } from "@/lib/mark-finished";
import type { TextSummary } from "@/lib/types";
import { CheckIcon } from "../icons";
import { useMe } from "../me-context";
import { Button, ErrorNote } from "../ui";

const ICON_BUTTON = "flex items-center rounded-md px-2 py-1 text-xs text-muted hover:bg-paper hover:text-ink";

export function MarkFinished({ text, onDone }: { text: TextSummary; onDone: (t: TextSummary) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const { refresh } = useMe();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = markFinishedLabel(text.kind);
  if (text.progress?.completed) return null;

  function close() {
    setError(null);
    dialog.current?.close();
  }

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ markedKnown: number }>(`texts/${text.id}/complete`, { method: "POST" });
      dialog.current?.close();
      onDone(finishedSummary(text, r.markedKnown));
      void refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => dialog.current?.showModal()} aria-label={label} title={label} className={ICON_BUTTON}>
        <CheckIcon className="size-4" />
      </button>
      <dialog
        ref={dialog} aria-labelledby={headingId} onClose={() => setError(null)}
        onClick={(e) => e.target === dialog.current && close()}
        className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-black/40"
      >
        <div className="space-y-4 p-5 text-sm">
          <div>
            <h2 id={headingId} className="font-display text-xl font-semibold">{label}?</h2>
            <p className="truncate text-muted" lang={text.language}>{text.title}</p>
          </div>
          <p>{markFinishedMessage(text)}</p>
          <ErrorNote message={error} />
          <div className="flex justify-end gap-2 border-t border-line pt-3">
            <Button type="button" variant="secondary" onClick={close}>Cancel</Button>
            <Button type="button" onClick={() => void confirm()} disabled={busy}>{label}</Button>
          </div>
        </div>
      </dialog>
    </>
  );
}
