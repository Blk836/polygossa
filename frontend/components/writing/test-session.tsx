"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { Button, FailureNote, inputClass } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { languageInfo } from "@/lib/languages";
import type { WritingTest } from "@/lib/types";
import { canHandIn, countWriting, formatClock, secondsLeft } from "@/lib/writing";

/**
 * The test itself: the situation, a countdown, and the answer box. Pasting is off; hand-in unlocks at the minimum;
 * at 0:00 the answer is handed in automatically, whatever its length.
 */
export function TestSession({ test, onDone }: { test: WritingTest; onDone: (t: WritingTest) => void }) {
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(test.timeLimitSeconds);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const count = countWriting(text, test.language);

  async function handIn() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await api<WritingTest>(`writing/tests/${test.id}/submit`, { body: { content: text } }));
    } catch (e) {
      setError(e instanceof ApiError ? e : String(e));
      setBusy(false);
    }
  }

  // The countdown follows the server's deadline (so reloading doesn't buy time) and hands in at zero.
  const onTimeUp = useEffectEvent(() => void handIn());
  useEffect(() => {
    let done = false;
    const tick = () => {
      const left = secondsLeft(test.deadline, Date.now());
      setRemaining(left);
      if (left === 0 && !done) {
        done = true;
        onTimeUp();
      }
    };
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 250);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [test.deadline]);

  const enough = count >= test.minWords;
  const urgent = remaining <= 30;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-card p-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-rubric uppercase">Your situation · {test.level}</p>
          <p className="mt-2 font-reading text-lg leading-relaxed">{test.prompt}</p>
          <p className="mt-2 text-sm text-muted">
            Write in {languageInfo(test.language)?.name}, at least {test.minWords} {test.unit}.
          </p>
        </div>
        <div className={`shrink-0 rounded-lg px-3 py-2 text-center ${urgent ? "bg-bad-soft text-bad" : "bg-paper"}`} role="timer" aria-live={urgent ? "assertive" : "off"}>
          <p className="font-display text-3xl font-semibold tabular-nums">{formatClock(remaining)}</p>
          <p className="text-[11px] text-muted">left</p>
        </div>
      </div>
      <textarea
        className={`${inputClass} min-h-64 font-reading text-base leading-relaxed`}
        lang={test.language}
        value={text}
        autoFocus
        spellCheck={false}
        autoCorrect="off"
        disabled={busy || remaining === 0}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          e.preventDefault();
          setPasteBlocked(true);
        }}
        aria-label="Your answer"
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => void handIn()} disabled={busy || !canHandIn(count, test.minWords, remaining)}>
          {busy ? "Grading…" : "Hand in"}
        </Button>
        <span className={`text-sm tabular-nums ${enough ? "text-good" : "text-muted"}`}>
          {count} / {test.minWords} {test.unit}
        </span>
        {pasteBlocked && <span className="text-sm text-muted">Pasting is turned off during a test.</span>}
      </div>
      <FailureNote error={error} />
    </div>
  );
}
