export const MAX_AHEAD_MS = 1000;

export const HOLD_MS = 250;

export const SEEK_TOLERANCE_MS = 1500;

export const SEEK_TIMEOUT_MS = 3000;

export interface MediaClock {
  read(reportedMs: number, nowMs: number, playing: boolean, rate: number): number;
  seek(targetMs: number, nowMs: number): void;
  reset(): void;
}

export function createMediaClock(): MediaClock {
  let base: { reported: number; at: number } | null = null;
  let shown: number | null = null;
  let seeking: { target: number; at: number } | null = null;
  const reset = () => {
    base = null;
    shown = null;
    seeking = null;
  };
  const held = (reportedMs: number, nowMs: number) => {
    if (!seeking) return null;
    if (Math.abs(reportedMs - seeking.target) > SEEK_TOLERANCE_MS && nowMs - seeking.at < SEEK_TIMEOUT_MS) return seeking.target;
    seeking = null;
    return null;
  };
  return {
    read(reportedMs, nowMs, playing, rate) {
      const target = held(reportedMs, nowMs);
      if (target !== null) return target;
      if (!playing) {
        reset();
        return reportedMs;
      }
      const since = base?.reported === reportedMs ? base : { reported: reportedMs, at: nowMs };
      base = since;
      const ms = reportedMs + Math.min(Math.max(0, nowMs - since.at) * rate, MAX_AHEAD_MS);
      if (shown === null || ms >= shown || shown - ms > HOLD_MS) shown = ms;
      return shown;
    },
    seek(targetMs, nowMs) {
      reset();
      seeking = { target: targetMs, at: nowMs };
    },
    reset,
  };
}
