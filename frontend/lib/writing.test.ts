import { describe, expect, it } from "vitest";
import { WRITING_LEVELS, canHandIn, countWriting, formatClock, scoreBand, secondsLeft } from "./writing";

describe("countWriting (mirrors the server's WritingRules.count)", () => {
  it("counts runs of letters and digits as words", () => {
    expect(countWriting("Je suis allé au marché, puis j'ai mangé.", "fr")).toBe(9);
    expect(countWriting("  Hola   mundo  \n 2026 ", "es")).toBe(3);
    expect(countWriting("안녕하세요. 저는 학생이에요!", "ko")).toBe(3);
    expect(countWriting("— ... !!", "fr")).toBe(0);
    expect(countWriting("", "fr")).toBe(0);
  });

  it("counts characters for Japanese and Chinese, ignoring spaces and punctuation", () => {
    expect(countWriting("今日は、いい天気です。", "ja")).toBe(9);
    expect(countWriting("我 喜欢 咖啡！", "zh")).toBe(5);
  });
});

describe("secondsLeft", () => {
  const deadline = "2026-10-01T09:05:00Z";
  const at = (iso: string) => Date.parse(iso);

  it("counts down to the deadline, rounding up partial seconds", () => {
    expect(secondsLeft(deadline, at("2026-10-01T09:00:00Z"))).toBe(300);
    expect(secondsLeft(deadline, at("2026-10-01T09:04:59.200Z"))).toBe(1);
  });

  it("never goes below zero", () => {
    expect(secondsLeft(deadline, at("2026-10-01T09:05:00Z"))).toBe(0);
    expect(secondsLeft(deadline, at("2026-10-01T09:07:00Z"))).toBe(0);
  });
});

describe("formatClock", () => {
  it("shows minutes and two-digit seconds", () => {
    expect(formatClock(300)).toBe("5:00");
    expect(formatClock(61)).toBe("1:01");
    expect(formatClock(9)).toBe("0:09");
    expect(formatClock(0)).toBe("0:00");
  });
});

describe("canHandIn", () => {
  it("needs the minimum while time remains", () => {
    expect(canHandIn(59, 60, 120)).toBe(false);
    expect(canHandIn(60, 60, 120)).toBe(true);
  });

  it("takes anything non-empty once time is up", () => {
    expect(canHandIn(5, 60, 0)).toBe(true);
    expect(canHandIn(0, 60, 0)).toBe(false);
  });
});

describe("scoreBand", () => {
  it("labels scores in bands", () => {
    expect(scoreBand(95)).toBe("Excellent");
    expect(scoreBand(85)).toBe("Excellent");
    expect(scoreBand(84)).toBe("Strong");
    expect(scoreBand(70)).toBe("Strong");
    expect(scoreBand(69)).toBe("Good");
    expect(scoreBand(55)).toBe("Good");
    expect(scoreBand(54)).toBe("Developing");
    expect(scoreBand(40)).toBe("Developing");
    expect(scoreBand(39)).toBe("Keep practising");
    expect(scoreBand(0)).toBe("Keep practising");
  });
});

describe("WRITING_LEVELS", () => {
  it("offers every CEFR level", () => {
    expect(WRITING_LEVELS).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
  });
});
