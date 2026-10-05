"use client";

import { useCallback, useEffect, useRef } from "react";
import { api, beacon } from "@/lib/api";

const HEARTBEAT_MS = 15_000;
/** Time without any interaction after which the reader is considered idle and stops accruing reading time. */
const IDLE_MS = 2 * 60_000;

/**
 * Records a reading session for the open text: active, visible time is sent to the backend in heartbeats so the
 * dashboard can show time spent reading.
 */
export function useReadingSession(textId: number) {
  const sessionId = useRef<number | null>(null);
  const lastBeat = useRef(0);
  const lastActivity = useRef(0);

  const flush = useCallback((useBeacon: boolean) => {
    const id = sessionId.current;
    const now = Date.now();
    const idle = now - lastActivity.current > IDLE_MS;
    const seconds = Math.round((now - lastBeat.current) / 1000);
    lastBeat.current = now;
    if (!id || idle || seconds <= 0) return;
    if (useBeacon) beacon(`sessions/${id}/heartbeat`, { seconds });
    else void api(`sessions/${id}/heartbeat`, { body: { seconds } }).catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    lastBeat.current = Date.now();
    lastActivity.current = Date.now();
    api<{ id: number }>("sessions", { body: { textId } })
      .then((s) => {
        if (!cancelled) {
          sessionId.current = s.id;
          lastBeat.current = Date.now();
        }
      })
      .catch(() => {});

    const markActive = () => (lastActivity.current = Date.now());
    const events = ["pointerdown", "keydown", "scroll", "touchstart", "mousemove"] as const;
    events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") flush(false);
      else lastBeat.current = Date.now();
    }, HEARTBEAT_MS);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(true);
      else lastBeat.current = Date.now();
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      flush(true);
      window.clearInterval(interval);
      events.forEach((e) => window.removeEventListener(e, markActive));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [textId, flush]);

  const complete = useCallback(async () => {
    flush(false);
    if (sessionId.current) await api(`sessions/${sessionId.current}/complete`, { method: "POST" });
  }, [flush]);

  return { complete };
}
