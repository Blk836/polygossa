// Smooths a player's coarse time reports into a per-frame playback position. YouTube's iframe player only reports its
// time a few times a second, so read directly the highlighted word lags, then jumps.

/** Furthest the clock runs past the player's last report, so a stall (buffering) stops it there. */
export const MAX_AHEAD_MS = 1000;

/** A report at most this far behind what was last shown is held, so it doesn't flash the previous word. */
export const HOLD_MS = 250;

/** After a seek, a report this close to the target shows the player got there. */
export const SEEK_TOLERANCE_MS = 1500;

/** Longest a seek's target is shown without the player confirming it. */
export const SEEK_TIMEOUT_MS = 3000;

export interface MediaClock {
  /** The playback position at `nowMs` (e.g. `performance.now()`), given the player's latest reported position. */
  read(reportedMs: number, nowMs: number, playing: boolean, rate: number): number;
  /**
   * Shows `targetMs` until the player reports a time near it: YouTube reports the old time for a moment after a seek,
   * and showing it would pull the seek bar back (and a mouse release there would seek back).
   */
  seek(targetMs: number, nowMs: number): void;
  /** Forgets the last report and shown position: call on speed changes. */
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
  /** The target while a seek is unconfirmed, else null (and the seek is over). */
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
