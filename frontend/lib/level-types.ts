import type { CefrLevel, LanguageCode } from "./types";

export type LevelConfidence = "low" | "medium" | "high";

export interface Skill {
  level?: CefrLevel;
  confidence?: LevelConfidence;
  evidence: number;
}

export type SkillKey = "reading" | "listening" | "writing";

export interface SkillLevels {
  language: LanguageCode;
  knownWords: number;
  listeningSeconds: number;
  reading: Skill;
  listening: Skill;
  writing: Skill;
  overall?: { level: CefrLevel; basedOn: SkillKey[] };
}
