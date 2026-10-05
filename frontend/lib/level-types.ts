// Response types for GET /api/levels (Skill levels on Progress), kept in sync with SkillLevelService and SkillLevels.
import type { CefrLevel, LanguageCode } from "./types";

/** How sure a skill level is, from how much evidence it rests on. */
export type LevelConfidence = "low" | "medium" | "high";

/** One skill's level; `level` and `confidence` are absent when there isn't enough data. */
export interface Skill {
  level?: CefrLevel;
  confidence?: LevelConfidence;
  /** Finished texts (Reading), finished videos and audio (Listening) or graded tests (Writing). */
  evidence: number;
}

export type SkillKey = "reading" | "listening" | "writing";

/** GET /api/levels: Reading, Listening and Writing levels in one language. */
export interface SkillLevels {
  language: LanguageCode;
  knownWords: number;
  listeningSeconds: number;
  reading: Skill;
  listening: Skill;
  writing: Skill;
  /** The average of the skills with a level; absent when none has. */
  overall?: { level: CefrLevel; basedOn: SkillKey[] };
}
