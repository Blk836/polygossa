import { describe, expect, it } from "vitest";
import { ListenClock } from "./listen-clock";

describe("ListenClock", () => {
  it("counts playing time between plays and pauses", () => {
    const c = new ListenClock();
    c.set(true, 1_000);
    c.set(false, 5_000);
    expect(c.take(9_000)).toBe(4);
    expect(c.take(10_000)).toBe(0);
  });

  it("counts time still playing at a heartbeat, and keeps counting after it", () => {
    const c = new ListenClock();
    c.set(true, 0);
    expect(c.take(15_000)).toBe(15);
    expect(c.take(30_000)).toBe(15);
  });

  it("keeps parts of a second for the next heartbeat", () => {
    const c = new ListenClock();
    c.set(true, 0);
    c.set(false, 1_500);
    expect(c.take(2_000)).toBe(1);
    c.set(true, 3_000);
    c.set(false, 3_500);
    expect(c.take(4_000)).toBe(1);
  });

  it("ignores repeated plays and pauses", () => {
    const c = new ListenClock();
    c.set(false, 0);
    c.set(true, 1_000);
    c.set(true, 2_000);
    c.set(false, 3_000);
    c.set(false, 4_000);
    expect(c.take(5_000)).toBe(2);
  });
});
