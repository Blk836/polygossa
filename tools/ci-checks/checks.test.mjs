import { test } from "node:test";
import assert from "node:assert/strict";
import { ALL, checksFor, outputLines } from "./checks.mjs";

const only = (...names) => Object.fromEntries(ALL.map((name) => [name, names.includes(name)]));
const everything = only(...ALL);

test("the checks are backend, end-to-end, frontend, images, infra and tools", () => {
  assert.deepEqual(ALL, ["backend", "e2e", "frontend", "images", "infra", "tools"]);
});

test("the Dockerfiles and their ignore files build only the images", () => {
  for (const file of ["backend/Dockerfile", "backend/Dockerfile.dockerignore", "frontend/Dockerfile",
    "frontend/.dockerignore"]) {
    assert.deepEqual(checksFor([file]), only("images"), file);
  }
});

test("the CDK image definitions run the infra, tools and images checks", () => {
  assert.deepEqual(checksFor(["infra/lib/images.ts"]), only("infra", "tools", "images"));
});

test("the frontend's packages and Next config also build the images", () => {
  for (const file of ["frontend/package.json", "frontend/package-lock.json", "frontend/next.config.ts"]) {
    assert.deepEqual(checksFor([file]), only("frontend", "tools", "e2e", "images"), file);
  }
});

test("ordinary source changes don't build the images", () => {
  assert.equal(checksFor(["backend/src/main/java/app/lector/App.java", "frontend/app/page.tsx"]).images, false);
});

test("backend changes run the backend, end-to-end and tools (no comments) checks", () => {
  assert.deepEqual(checksFor(["backend/src/main/java/app/lector/App.java"]), only("backend", "e2e", "tools"));
});

test("the Gradle build counts as the backend and builds the images", () => {
  for (const file of ["build.gradle.kts", "settings.gradle.kts", "gradle/wrapper/gradle-wrapper.properties",
    "gradle/libs.versions.toml", "gradlew", "gradlew.bat", "backend/build.gradle.kts"]) {
    assert.deepEqual(checksFor([file]), only("backend", "e2e", "tools", "images"), file);
  }
});

test("the checkstyle rules count as the backend", () => {
  assert.deepEqual(checksFor(["config/checkstyle/checkstyle.xml"]), only("backend", "e2e", "tools"));
});

test("frontend changes run the frontend, tools (they use its ESLint) and end-to-end checks", () => {
  assert.deepEqual(checksFor(["frontend/app/page.tsx"]), only("frontend", "tools", "e2e"));
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
    ["backend=false", "e2e=false", "frontend=false", "images=false", "infra=true", "tools=true"]);
});
