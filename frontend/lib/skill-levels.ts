import type { Skill, SkillKey, SkillLevels } from "./types";

export const SKILLS: readonly SkillKey[] = ["reading", "listening", "writing"];

export const SKILL_NAMES: Record<SkillKey, string> = { reading: "Reading", listening: "Listening", writing: "Writing" };

export function levelText(skill: Skill): string {
  return skill.level ?? "Not enough data";
}

/** Low-confidence levels are labelled as estimates. */
export function isEstimate(skill: Skill): boolean {
  return skill.confidence === "low";
}

export function confidenceText(skill: Skill): string | null {
  switch (skill.confidence) {
    case "low":
      return "Estimate · low confidence";
    case "medium":
      return "Medium confidence";
    case "high":
      return "High confidence";
    default:
      return null;
  }
}

function count(n: number, one: string, many: string): string {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}

/** What a skill's level rests on; {@code listened} is the formatted listening time. */
export function evidenceText(key: SkillKey, levels: SkillLevels, listened: string): string {
  const n = levels[key].evidence;
  const parts: string[] = [];
  if (key === "reading") {
    parts.push(count(levels.knownWords, "known word", "known words"));
    if (n > 0) parts.push(count(n, "finished text", "finished texts"));
  } else if (key === "listening") {
    if (n > 0) parts.push(`${count(n, "video or audio lesson", "videos or audio lessons")} finished`);
    if (levels.listeningSeconds > 0) parts.push(`${listened} listened`);
  } else if (n > 0) {
    parts.push(`Based on ${count(n, "graded test", "graded tests")}`);
  }
  return parts.join(" · ");
}

/** For a skill without a level: how to get one. */
export function emptyHint(key: SkillKey): { text: string; href: string; action: string } {
  switch (key) {
    case "reading":
      return { text: "Mark words as known while you read to see your reading level.", href: "/library", action: "Start reading" };
    case "listening":
      return { text: "Finish a video or an audio lesson to see your listening level.", href: "/community", action: "Watch a video" };
    default:
      return { text: "Take a writing test to see your writing level.", href: "/writing", action: "Take a writing test" };
  }
}

export function overallText(overall: NonNullable<SkillLevels["overall"]>): string {
  const text = `Overall ${overall.level}`;
  if (overall.basedOn.length === SKILLS.length) return text;
  return `${text} · based on ${overall.basedOn.map((k) => SKILL_NAMES[k]).join(" and ")} only`;
}
