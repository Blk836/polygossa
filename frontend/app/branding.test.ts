// The app's name comes from one setting (lib/brand.ts, BRAND_NAME). The signed-out pages (/, /login, /signup) can't be
// opened in e2e while auto-login redirects them to the library, so this checks the source instead: no old "Lector"
// brand and no hard-coded copy of the current one. Lower-case internals (the lector_token cookie, test@lector.local)
// are deliberately kept.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_BRAND } from "@/lib/brand";

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
const read = (page: string) => readFileSync(join(__dirname, page), "utf8");

describe("branding", () => {
  it("never shows the old Lector name", () => {
    expect(sources().filter((f) => /\bLector\b/.test(readFileSync(f, "utf8"))).map(relative)).toEqual([]);
  });

  it("spells the brand out only in lib/brand.ts", () => {
    const hardCoded = sources().filter((f) => readFileSync(f, "utf8").includes(DEFAULT_BRAND)).map(relative);
    expect(hardCoded).toEqual(["lib/brand.ts"]);
  });

  it("titles every page with the brand", () => {
    expect(read("layout.tsx")).toContain("title: { default: `${BRAND} — learn languages by reading`, template: `%s · ${BRAND}` }");
  });

  it("names the brand on the landing, login and signup pages", () => {
    expect(read("page.tsx")).toContain("{BRAND} · <Link");
    for (const page of ["login/page.tsx", "signup/page.tsx"]) {
      expect(read(page), page).toContain("aria-label={`${BRAND} home`}><Logo");
    }
  });
});
