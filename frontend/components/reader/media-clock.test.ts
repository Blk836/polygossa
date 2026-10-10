import { describe, expect, it } from "vitest";
import { createMediaClock, HOLD_MS, MAX_AHEAD_MS, SEEK_TIMEOUT_MS, SEEK_TOLERANCE_MS } from "./media-clock";

describe("media clock", () => {
  it("passes the reported time through while paused", () => {
    const clock = createMediaClock();
    expect(clock.read(5000, 100, false, 1)).toBe(5000);
    expect(clock.read(5000, 900, false, 1)).toBe(5000);
  });

  it("advances between the player's (coarse) reports while playing", () => {
    const clock = createMediaClock();
    expect(clock.read(5000, 1000, true, 1)).toBe(5000);
    expect(clock.read(5000, 1120, true, 1)).toBe(5120);
    expect(clock.read(5000, 1240, true, 1)).toBe(5240);
  });

  it("advances at the playback speed", () => {
    const clock = createMediaClock();
    clock.read(5000, 1000, true, 0.75);
    expect(clock.read(5000, 1120, true, 0.75)).toBe(5090);
    const fast = createMediaClock();
    fast.read(5000, 1000, true, 2);
    expect(fast.read(5000, 1100, true, 2)).toBe(5200);
  });

  it("restarts from each new report, so no drift builds up", () => {
    const clock = createMediaClock();
    clock.read(5000, 1000, true, 1);
    clock.read(5000, 1200, true, 1);
    expect(clock.read(5300, 1210, true, 1)).toBe(5300);
    expect(clock.read(5300, 1260, true, 1)).toBe(5350);
  });

  it("stops at most a second past the last report when the player stalls", () => {
    const clock = createMediaClock();
    clock.read(5000, 1000, true, 1);
    expect(clock.read(5000, 1000 + MAX_AHEAD_MS, true, 1)).toBe(5000 + MAX_AHEAD_MS);
    expect(clock.read(5000, 9000, true, 1)).toBe(5000 + MAX_AHEAD_MS);
    expect(MAX_AHEAD_MS).toBe(1000);
  });

  it("holds through a report slightly behind its estimate instead of flashing the previous word", () => {
    const clock = createMediaClock();
    clock.read(5000, 1000, true, 1);
    expect(clock.read(5000, 1200, true, 1)).toBe(5200);
    expect(clock.read(5100, 1210, true, 1)).toBe(5200);
    expect(clock.read(5100, 1310, true, 1)).toBe(5200);
    expect(clock.read(5100, 1330, true, 1)).toBe(5220);
    expect(HOLD_MS).toBe(250);
  });

  it("holds a report exactly HOLD_MS behind, but follows one further back (a seek)", () => {
    const clock = createMediaClock();
    clock.read(5000, 1000, true, 1);
    clock.read(5000, 1400, true, 1);
    expect(clock.read(5150, 1401, true, 1)).toBe(5400);
    const seeked = createMediaClock();
    seeked.read(5000, 1000, true, 1);
    seeked.read(5000, 1400, true, 1);
    expect(seeked.read(5149, 1401, true, 1)).toBe(5149);
  });

  it("forgets what it showed once paused, and on reset", () => {
    const clock = createMediaClock();
    clock.read(5000, 1000, true, 1);
    clock.read(5000, 1200, true, 1);
    clock.read(5100, 1300, false, 1);
    expect(clock.read(5100, 1300, true, 1)).toBe(5100);
    clock.read(5100, 1400, true, 1);
    clock.reset();
    expect(clock.read(5150, 1410, true, 1)).toBe(5150);
    expect(clock.read(5150, 1420, true, 1)).toBe(5160);
  });

  it("never extrapolates backwards if the system clock does", () => {
    const clock = createMediaClock();
    clock.read(5000, 1000, true, 1);
    expect(clock.read(5000, 900, true, 1)).toBe(5000);
  });

  describe("after a seek", () => {
    it("shows the target while the player still reports the old time, playing or paused", () => {
      const clock = createMediaClock();
      clock.read(60_000, 1000, true, 1);
      clock.seek(300_000, 1010);
      expect(clock.read(60_000, 1020, true, 1)).toBe(300_000);
      expect(clock.read(60_300, 1300, true, 1)).toBe(300_000);
      expect(clock.read(60_300, 1400, false, 1)).toBe(300_000);
    });

    it("follows the player again once it reports a time near the target", () => {
      const clock = createMediaClock();
      clock.seek(300_000, 1000);
      expect(clock.read(300_000 + SEEK_TOLERANCE_MS, 1500, true, 1)).toBe(300_000 + SEEK_TOLERANCE_MS);
      expect(clock.read(60_000, 1600, true, 1)).toBe(60_000);
      expect(SEEK_TOLERANCE_MS).toBe(1500);
    });

    it("treats a report just past the tolerance, either side, as the old position", () => {
      const clock = createMediaClock();
      clock.seek(300_000, 1000);
      expect(clock.read(300_000 + SEEK_TOLERANCE_MS + 1, 1100, true, 1)).toBe(300_000);
      expect(clock.read(300_000 - SEEK_TOLERANCE_MS - 1, 1200, true, 1)).toBe(300_000);
      expect(clock.read(300_000 - SEEK_TOLERANCE_MS, 1300, false, 1)).toBe(300_000 - SEEK_TOLERANCE_MS);
    });

    it("holds a backward seek too", () => {
      const clock = createMediaClock();
      clock.read(300_000, 1000, true, 1);
      clock.seek(60_000, 1010);
      expect(clock.read(300_000, 1100, true, 1)).toBe(60_000);
      expect(clock.read(60_100, 1200, true, 1)).toBe(60_100);
    });

    it("starts smoothing afresh from the confirming report", () => {
      const clock = createMediaClock();
      clock.read(60_000, 1000, true, 1);
      clock.read(60_000, 1500, true, 1);
      clock.seek(300_000, 1510);
      expect(clock.read(300_200, 2000, true, 1)).toBe(300_200);
      expect(clock.read(300_200, 2100, true, 1)).toBe(300_300);
    });

    it("follows a small step back at once instead of holding the old position", () => {
      const clock = createMediaClock();
      clock.read(60_000, 1000, true, 1);
      clock.read(60_000, 1500, true, 1);
      clock.seek(60_000, 1510);
      expect(clock.read(60_300, 1600, true, 1)).toBe(60_300);
    });

    it("gives up on a seek the player never confirms", () => {
      const clock = createMediaClock();
      clock.seek(300_000, 1000);
      expect(clock.read(60_000, 1000 + SEEK_TIMEOUT_MS - 1, true, 1)).toBe(300_000);
      expect(clock.read(60_000, 1000 + SEEK_TIMEOUT_MS, true, 1)).toBe(60_000);
      expect(clock.read(60_000, 1000 + SEEK_TIMEOUT_MS + 100, true, 1)).toBe(60_100);
      expect(SEEK_TIMEOUT_MS).toBe(3000);
    });

    it("holds the latest target when seeking again before the first is confirmed", () => {
      const clock = createMediaClock();
      clock.seek(300_000, 1000);
      clock.seek(480_000, 1100);
      expect(clock.read(300_000, 1200, true, 1)).toBe(480_000);
      expect(clock.read(480_000, 1300, true, 1)).toBe(480_000);
    });

    it("forgets the target on reset", () => {
      const clock = createMediaClock();
      clock.seek(300_000, 1000);
      clock.reset();
      expect(clock.read(60_000, 1100, true, 1)).toBe(60_000);
    });
  });
});
