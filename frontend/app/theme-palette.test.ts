import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");
const css = readFileSync(join(__dirname, "globals.css"), "utf8");

function tokens(): Map<string, [string, string]> {
  const out = new Map<string, [string, string]>();
  for (const m of css.matchAll(/--([\w-]+):\s*light-dark\(\s*(#[0-9a-fA-F]{6})\s*,\s*(#[0-9a-fA-F]{6})\s*\)/g)) {
    out.set(m[1], [m[2], m[3]]);
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_ON: [fg: string, bg: string][] = [
  ["ink", "paper"], ["ink", "card"], ["muted", "paper"], ["muted", "card"],
  ["accent", "paper"], ["accent", "card"], ["accent-ink", "accent"], ["ink", "accent-soft"],
  ["rubric", "paper"], ["rubric", "card"], ["danger", "paper"], ["danger", "card"],
  ["good", "card"], ["good", "good-soft"], ["warn", "card"], ["warn", "warn-soft"], ["bad", "card"], ["bad", "bad-soft"],
  ["ink", "w-new"], ["ink", "w-learning"], ["ink", "w-known"], ["ink", "w-ignored"], ["ink", "w-active"], ["ink", "w-sentence"],
  ["ink", "tile-known"], ["ink", "tile-learning"], ["ink", "tile-new"], ["muted", "tile-next"], ["muted", "tile-later"],
  ...["learners", "daily-life", "stories", "news", "culture", "travel", "food", "science", "history", "entertainment", "other"]
    .flatMap((c): [string, string][] => [["ink", `cover-${c}`], ["muted", `cover-${c}`]]),
];

const MARK_ON: [mark: string, bg: string][] = [["w-marker", "paper"], ["w-marker", "w-sentence"]];

describe("theme tokens", () => {
  const t = tokens();

  it("define a light and a dark value for every colour the pairs use", () => {
    const needed = new Set([...TEXT_ON.flat(), ...MARK_ON.flat()]);
    expect([...needed].filter((n) => !t.has(n))).toEqual([]);
  });

  it.each(TEXT_ON)("%s on %s meets WCAG AA (4.5:1) in light and dark", (fg, bg) => {
    const [fl, fd] = t.get(fg)!;
    const [bl, bd] = t.get(bg)!;
    expect(contrast(fl, bl), "light").toBeGreaterThanOrEqual(4.5);
    expect(contrast(fd, bd), "dark").toBeGreaterThanOrEqual(4.5);
  });

  it.each(MARK_ON)("%s on %s meets the 3:1 non-text contrast in light and dark", (mark, bg) => {
    const [ml, md] = t.get(mark)!;
    const [bl, bd] = t.get(bg)!;
    expect(contrast(ml, bl), "light").toBeGreaterThanOrEqual(3);
    expect(contrast(md, bd), "dark").toBeGreaterThanOrEqual(3);
  });

  it.each(["w-new", "w-learning"])("keeps the spoken-sentence tint fainter than %s, so word colours read on top", (status) => {
    for (const mode of [0, 1]) {
      const paper = t.get("paper")![mode];
      expect(contrast(t.get("w-sentence")![mode], paper)).toBeLessThan(contrast(t.get(status)![mode], paper));
    }
  });

  it("makes the vocabulary map's next band paler than new words, and later bands paler still", () => {
    for (const mode of [0, 1]) {
      const against = (name: string) => contrast(t.get(name)![mode], t.get("tile-grout")![mode]);
      expect(against("tile-next")).toBeLessThan(against("tile-new"));
      expect(against("tile-later")).toBeLessThan(against("tile-next"));
    }
  });

  it("lets an explicit choice override the OS setting", () => {
    expect(css).toMatch(/:root\[data-theme="light"\]\s*{\s*color-scheme:\s*light;/);
    expect(css).toMatch(/:root\[data-theme="dark"\]\s*{\s*color-scheme:\s*dark;/);
    expect(css).not.toMatch(/prefers-color-scheme/);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("components", () => {
  it("never use Tailwind's OS-only dark: variant", () => {
    const offenders = ["app", "components", "lib"]
      .flatMap((d) => sourceFiles(join(root, d)))
      .filter((f) => /\bdark:/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
