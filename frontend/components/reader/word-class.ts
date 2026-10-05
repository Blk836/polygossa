// The classes on a reader word: its status (LingQ-style colours in globals.css: new blue, learning yellow, known and
// ignored plain), the selection, the word being spoken, and an underline when it's part of a phrase being learned.
import type { Token, WordStatus } from "@/lib/types";
import type { Range } from "./reader-text";

export interface WordMarks {
  statuses: Record<string, WordStatus>;
  sel: Range | null;
  active: number | null;
  phrases: Map<number, WordStatus>;
}

export function wordClass(t: Token, { statuses, sel, active, phrases }: WordMarks): string {
  const classes = ["w", `w-${statuses[t.normalized!] ?? "new"}`];
  if (sel && t.index >= sel.start && t.index <= sel.end) classes.push("w-selected");
  if (active === t.index) classes.push("w-speaking");
  if (phrases.get(t.index) === "learning") classes.push("p-learning");
  return classes.join(" ");
}
