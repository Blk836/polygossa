import type { CefrLevel, LanguageCode, Person } from "./types";

export interface ClassSummary {
  id: number;
  name: string;
  language: LanguageCode;
  role: "teacher" | "student";
  teacherName: string;
  joinCode?: string;
  studentCount: number;
  createdAt: string;
}

export interface Assignment {
  id: number;
  textId: number;
  textTitle: string;
  cefrLevel: CefrLevel;
  wordCount: number;
  dueDate?: string;
  note?: string;
  assignedAt: string;
  opened?: boolean;
  completed?: boolean;
}

export interface ClassDetail {
  info: ClassSummary;
  assignments: Assignment[];
  students: (Person & { email: string; joinedAt: string })[];
}

export interface StudentProgress {
  id: number;
  displayName: string;
  photoUrl: string | null;
  knownWords: number;
  learningWords: number;
  wordsAdded7d: number;
  wordsAdded30d: number;
  sessions: number;
  readingSeconds: number;
  assignmentsOpened: number;
  assignmentsCompleted: number;
  lastActive?: string;
}

export interface ClassProgress {
  assignmentCount: number;
  students: StudentProgress[];
  averageKnownWords: number;
  averageReadingMinutes: number;
  assignmentCompletionRate: number;
}
