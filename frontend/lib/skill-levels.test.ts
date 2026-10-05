import { describe, expect, it } from "vitest";
import { confidenceText, emptyHint, evidenceText, isEstimate, levelText, overallText, SKILLS, SKILL_NAMES } from "./skill-levels";
import type { Skill, SkillLevels } from "./types";

const levels = (over: Partial<SkillLevels> = {}): SkillLevels => ({
  language: "es",
  knownWords: 0,
  listeningSeconds: 0,
  reading: { evidence: 0 },
  listening: { evidence: 0 },
  writing: { evidence: 0 },
  ...over,
});

const skill = (level: Skill["level"], confidence: Skill["confidence"], evidence = 1): Skill => ({ level, confidence, evidence });

describe("skills", () => {
  it("lists Reading, Listening and Writing in that order", () => {
    expect(SKILLS).toEqual(["reading", "listening", "writing"]);
    expect(SKILLS.map((s) => SKILL_NAMES[s])).toEqual(["Reading", "Listening", "Writing"]);
  });
});

describe("levelText", () => {
  it("shows the level, or that there isn't enough data", () => {
    expect(levelText(skill("B1", "medium"))).toBe("B1");
    expect(levelText({ evidence: 0 })).toBe("Not enough data");
  });
});

describe("isEstimate and confidenceText", () => {
  it("marks low confidence as an estimate", () => {
    expect(isEstimate(skill("A2", "low"))).toBe(true);
    expect(isEstimate(skill("A2", "medium"))).toBe(false);
    expect(isEstimate(skill("A2", "high"))).toBe(false);
    expect(isEstimate({ evidence: 0 })).toBe(false);
  });

  it("describes the confidence", () => {
    expect(confidenceText(skill("A2", "low"))).toBe("Estimate · low confidence");
    expect(confidenceText(skill("A2", "medium"))).toBe("Medium confidence");
    expect(confidenceText(skill("A2", "high"))).toBe("High confidence");
    expect(confidenceText({ evidence: 0 })).toBeNull();
  });
});

describe("evidenceText", () => {
  it("bases Reading on known words and finished texts", () => {
    const l = levels({ knownWords: 1300, reading: skill("B1", "medium", 3) });
    expect(evidenceText("reading", l, "")).toBe("1,300 known words · 3 finished texts");
    expect(evidenceText("reading", levels({ knownWords: 1, reading: skill("A1", "low", 1) }), "")).toBe("1 known word · 1 finished text");
    expect(evidenceText("reading", levels({ knownWords: 60, reading: skill("A1", "low", 0) }), "")).toBe("60 known words");
  });

  it("bases Listening on finished videos and audio, with time listened", () => {
    const l = levels({ listeningSeconds: 5700, listening: skill("B1", "medium", 6) });
    expect(evidenceText("listening", l, "1h 35m")).toBe("6 videos or audio lessons finished · 1h 35m listened");
    expect(evidenceText("listening", levels({ listening: skill("A1", "low", 1) }), "")).toBe("1 video or audio lesson finished");
    expect(evidenceText("listening", levels({ listeningSeconds: 120 }), "2 min")).toBe("2 min listened");
    expect(evidenceText("listening", levels(), "")).toBe("");
  });

  it("bases Writing on graded tests", () => {
    expect(evidenceText("writing", levels({ writing: skill("B1", "low", 2) }), "")).toBe("Based on 2 graded tests");
    expect(evidenceText("writing", levels({ writing: skill("B1", "low", 1) }), "")).toBe("Based on 1 graded test");
    expect(evidenceText("writing", levels(), "")).toBe("");
  });
});

describe("emptyHint", () => {
  it("says what to do to get a level", () => {
    expect(emptyHint("reading")).toEqual({ text: "Mark words as known while you read to see your reading level.", href: "/library", action: "Start reading" });
    expect(emptyHint("listening")).toEqual({ text: "Finish a video or an audio lesson to see your listening level.", href: "/community", action: "Watch a video" });
    expect(emptyHint("writing")).toEqual({ text: "Take a writing test to see your writing level.", href: "/writing", action: "Take a writing test" });
  });
});

describe("overallText", () => {
  it("names the skills it rests on unless it rests on all three", () => {
    expect(overallText({ level: "B1", basedOn: ["reading", "listening", "writing"] })).toBe("Overall B1");
    expect(overallText({ level: "B1", basedOn: ["reading"] })).toBe("Overall B1 · based on Reading only");
    expect(overallText({ level: "A2", basedOn: ["reading", "writing"] })).toBe("Overall A2 · based on Reading and Writing only");
  });
});
