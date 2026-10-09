import { describe, expect, it } from "vitest";
import { hashSeed } from "./map-geometry";

describe("hashSeed", () => {
  it("hashes strings to distinct unsigned seeds", () => {
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
    expect(hashSeed("")).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(hashSeed("food & drink"))).toBe(true);
  });

  it("is FNV-1a, so every shape built from it is the same on every visit", () => {
    expect(hashSeed("")).toBe(0x811c9dc5);
    expect(hashSeed("a")).toBe(0xe40c292c);
    expect(hashSeed("foobar")).toBe(0xbf9cf968);
  });
});
