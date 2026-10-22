import { describe, expect, it } from "vitest";
import { oneIn, timesMetText } from "./times-met";

describe("times met", () => {
  it("shows how often a word was met and how common it is in my reading", () => {
    expect(timesMetText({ count: 120, share: 120 / 40000 })).toBe("Met 120 times · 1 in 330 words");
  });

  it("says once for a single meeting", () => {
    expect(timesMetText({ count: 1, share: 1 / 45000 })).toBe("Met once · 1 in 45,000 words");
  });

  it("says when a word hasn't been met yet", () => {
    expect(timesMetText({ count: 0, share: 0 })).toBe("Not met yet");
  });

  it("rounds 1 in N so it stays easy to read", () => {
    expect(oneIn(1 / 333.3)).toBe("1 in 330");
    expect(oneIn(1 / 4512)).toBe("1 in 4,500");
    expect(oneIn(1 / 45123)).toBe("1 in 45,000");
    expect(oneIn(1 / 25)).toBe("1 in 25");
    expect(oneIn(1 / 99.6)).toBe("1 in 100");
  });

  it("phrases show only how often they were met", () => {
    expect(timesMetText({ count: 12 })).toBe("Met 12 times");
    expect(timesMetText({ count: 1 })).toBe("Met once");
    expect(timesMetText({ count: 0 })).toBe("Not met yet");
  });

  it("writes large counts with separators", () => {
    expect(timesMetText({ count: 2000 })).toBe("Met 2,000 times");
  });
});
