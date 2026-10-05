import { describe, expect, it } from "vitest";
import type { Token } from "@/lib/types";
import { nextWord } from "./reader-text";

const t = (text: string, index: number): Token => ({ index, text, word: /\p{L}/u.test(text), sentence: 0 });
const tokens = [t("Uno", 0), t(" ", 1), t("dos", 2), t(". ", 3), t("tres", 4)];

describe("nextWord", () => {
  it("skips separators in either direction", () => {
    expect(nextWord(tokens, 0, 1)).toBe(2);
    expect(nextWord(tokens, 2, 1)).toBe(4);
    expect(nextWord(tokens, 4, -1)).toBe(2);
    expect(nextWord(tokens, 1, -1)).toBe(0);
  });

  it("returns null at either end", () => {
    expect(nextWord(tokens, 4, 1)).toBeNull();
    expect(nextWord(tokens, 0, -1)).toBeNull();
  });
});
