"use client";

import { createContext, useCallback, useEffect, useRef, useState } from "react";
import { api, beacon } from "@/lib/api";
import { ListenClock } from "./listen-clock";

const HEARTBEAT_MS = 15_000;
/** Time without any interaction after which the reader is considered idle and stops accruing reading time. */
const IDLE_MS = 2 * 60_000;

/** The open text's listening clock: the media player reports playing and pausing to it. */
export const ListenContext = createContext<ListenClock | null>(null);

/**
 * Records a reading session for the open text: active, visible time and time the audio or video played are sent to
 * the backend in heartbeats so Progress can show time spent reading and listening. Listening keeps counting while the
 * learner doesn't touch the page; reading time stops after two idle minutes.
 */
export function useReadingSession(textId: number) {
  const sessionId = useRef<number | null>(null);
  const lastBeat = useRef(0);
  const lastActivity = useRef(0);
  const [listen] = useState(() => new ListenClock());

  const flush = useCallback((useBeacon: boolean) => {
    const id = sessionId.current;
    const now = Date.now();
    const idle = now - lastActivity.current > IDLE_MS;
    const read = Math.round((now - lastBeat.current) / 1000);
    lastBeat.current = now;
    const seconds = idle ? 0 : Math.max(read, 0);
    const listenedSeconds = listen.take(now);
    if (!id || (seconds <= 0 && listenedSeconds <= 0)) return;
    const body = { seconds, listenedSeconds };
    if (useBeacon) beacon(`sessions/${id}/heartbeat`, body);
    else void api(`sessions/${id}/heartbeat`, { body }).catch(() => {});
  }, [listen]);

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

  return { complete, listen };
}
