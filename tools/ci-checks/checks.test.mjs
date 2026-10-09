import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL, checksFor, outputLines } from "./checks.mjs";

const only = (...names) => Object.fromEntries(ALL.map((name) => [name, names.includes(name)]));
const everything = only(...ALL);

test("the checks are backend, end-to-end, frontend, infra and tools", () => {
  assert.deepEqual(ALL, ["backend", "e2e", "frontend", "infra", "tools"]);
});

test("backend changes run the backend, end-to-end and tools (no comments) checks", () => {
  assert.deepEqual(checksFor(["backend/src/main/java/app/lector/App.java"]), only("backend", "e2e", "tools"));
});

test("the Gradle build and the checkstyle rules count as the backend", () => {
  for (const file of ["build.gradle.kts", "settings.gradle.kts", "gradle/wrapper/gradle-wrapper.properties",
    "gradle/libs.versions.toml", "gradlew", "gradlew.bat", "config/checkstyle/checkstyle.xml"]) {
    assert.deepEqual(checksFor([file]), only("backend", "e2e", "tools"), file);
  }
});

test("frontend changes run the frontend, tools (they use its ESLint) and end-to-end checks", () => {
  assert.deepEqual(checksFor(["frontend/app/page.tsx"]), only("frontend", "tools", "e2e"));
  assert.deepEqual(checksFor(["frontend/package-lock.json"]), only("frontend", "tools", "e2e"));
});

test("infra changes run the infra and tools (no comments) checks", () => {
  assert.deepEqual(checksFor(["infra/lib/staging-stack.ts"]), only("infra", "tools"));
});

test("tools changes run only the tools checks", () => {
  assert.deepEqual(checksFor(["tools/import-videos/run.mjs"]), only("tools"));
});

test("changes in several parts run each part's checks", () => {
  assert.deepEqual(checksFor(["backend/x.java", "infra/lib/y.ts"]), only("backend", "e2e", "infra", "tools"));
  assert.deepEqual(checksFor(["tools/a.mjs", "infra/b.ts"]), only("tools", "infra"));
});

test("changing CI itself runs everything", () => {
  assert.deepEqual(checksFor([".github/workflows/ci.yml"]), everything);
  assert.deepEqual(checksFor(["tools/ci-checks/checks.mjs"]), everything);
  assert.deepEqual(checksFor(["tools/ci-checks.mjs"]), everything);
});

test("a file outside the known parts runs everything", () => {
  for (const file of ["compose.dev.yml", "scripts/open-when-ready.ps1", ".env.example", "backendish.txt",
    "frontend.txt", "infrastructure/x"]) {
    assert.deepEqual(checksFor([file]), everything, file);
  }
});

test("docs and Markdown files run nothing, but don't stop other parts' checks", () => {
  assert.deepEqual(checksFor(["docs/marketing.md", "CLAUDE.md", "frontend/README.md"]), only());
  assert.deepEqual(checksFor(["docs/acceptance/ci.feature", "infra/lib/x.ts"]), only("infra", "tools"));
});

test("Windows-style paths and blank lines are handled", () => {
  assert.deepEqual(checksFor(["", "  ", "infra\\lib\\x.ts"]), only("infra", "tools"));
});

test("an unknown list of changed files runs everything", () => {
  assert.deepEqual(checksFor(null), everything);
});

test("the result is written as GitHub step outputs", () => {
  assert.deepEqual(outputLines(only("infra", "tools")),
    ["backend=false", "e2e=false", "frontend=false", "infra=true", "tools=true"]);
});
