import { describe, expect, it } from "vitest";
import { sharePercent, timesMetText } from "./times-met";

describe("times met", () => {
  it("shows the count and the share of everything read", () => {
    expect(timesMetText({ count: 120, share: 120 / 40000 })).toBe("120× · 0.3%");
  });

  it("says when a word hasn't been met yet", () => {
    expect(timesMetText({ count: 0, share: 0 })).toBe("Not met yet");
  });

  it("keeps percentages readable at every size", () => {
    expect(sharePercent(0.0394)).toBe("3.9%");
    expect(sharePercent(0.0031)).toBe("0.3%");
    expect(sharePercent(0.00031)).toBe("0.03%");
    expect(sharePercent(0.0000031)).toBe("<0.01%");
    expect(sharePercent(1)).toBe("100%");
  });

  it("writes large counts with separators", () => {
    expect(timesMetText({ count: 2000, share: 0.05 })).toBe("2,000× · 5%");
  });
});
