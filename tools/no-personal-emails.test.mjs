import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ALLOWED = ["example.com", "test.co", "b.co", "x.co", "lector.local", "users.noreply.github.com"];
const EMAIL = /[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;
const SKIPPED = /(^|\/)package-lock\.json$|\.(png|jpe?g|webp|gif|ico|woff2?|ttf|jar|zip|gz)$/i;

export function personalEmails(path, text) {
  const found = [];
  text.split(/\r?\n/).forEach((line, i) => {
    for (const match of line.matchAll(EMAIL)) {
      const domain = match[1].toLowerCase();
      if (!ALLOWED.some((ok) => domain === ok || domain.endsWith(`.${ok}`))) found.push(`${path}:${i + 1} ${match[0]}`);
    }
  });
  return found;
}

test("only placeholder and test addresses are allowed", () => {
  assert.deepEqual(personalEmails("a.md", "ana@example.com a@b.co x@test.co t@lector.local 1+me@users.noreply.github.com"), []);
  assert.deepEqual(personalEmails("a.md", "ok\nwrite to someone@gmail.com"), ["a.md:2 someone@gmail.com"]);
  assert.deepEqual(personalEmails("a.md", "me@notexample.com"), ["a.md:1 me@notexample.com"]);
});

test("no tracked file holds a personal email address", () => {
  const files = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0")
    .filter((f) => f && !SKIPPED.test(f));
  const found = files.flatMap((f) => {
    try {
      return personalEmails(f, readFileSync(join(root, f), "utf8"));
    } catch {
      return [];
    }
  });
  assert.deepEqual(found, []);
});

test("GitHub's deploy gives CDK the owner's email from a secret", () => {
  const workflow = readFileSync(join(root, ".github", "workflows", "ci.yml"), "utf8");
  const deploys = workflow.split(/\r?\n/).filter((line) => line.includes("cdk deploy"));
  assert.ok(deploys.length > 0);
  for (const line of deploys) assert.match(line, /-c owner-email="\$\{\{ secrets\.OWNER_EMAIL \}\}"/);
});
