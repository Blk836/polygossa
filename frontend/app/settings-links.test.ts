// Settings is split into sub-tab pages, so links into it name the page rather than an anchor on the old long page
// (/settings#plan still redirects, for bookmarks). Checked in the source, like branding.test.ts.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(__dirname, "..");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !name.endsWith(".test.ts") ? [path] : [];
  });
}

const sources = () => ["app", "components", "lib"].flatMap((d) => sourceFiles(join(root, d)));
const relative = (f: string) => f.slice(root.length + 1).replaceAll("\\", "/");
const linking = (pattern: RegExp) => sources().filter((f) => pattern.test(readFileSync(f, "utf8"))).map(relative).sort();

describe("links into Settings", () => {
  it("never point at the old #plan or #appearance anchors", () => {
    expect(linking(/["'`]\/settings#/)).toEqual([]);
  });

  it("send every plans link to the Subscription page", () => {
    expect(linking(/href="\/settings\/subscription"/)).toEqual([
      "app/(app)/classes/page.tsx",
      "components/reader/popup-parts.tsx",
      "components/ui.tsx",
      "components/vocabulary/word-import.tsx",
    ]);
  });
});
