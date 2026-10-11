import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BACKEND_IGNORE, FRONTEND_IGNORE, ignored } from "../lib/images.ts";

describe("what the deploy leaves out of each image", () => {
  it("the backend image gets only the Gradle build and the backend's sources", () => {
    assert.deepEqual(ignored(BACKEND_IGNORE), ["*", "!gradlew", "!settings.gradle.kts", "!build.gradle.kts", "!gradle",
      "!backend", "backend/build", "backend/data", "backend/bin", "backend/out"]);
  });

  it("the frontend image never gets packages, build output, test output or env files", () => {
    assert.deepEqual(ignored(FRONTEND_IGNORE), ["node_modules", ".next", "test-results", "playwright-report", "reports",
      ".stryker-tmp", "coverage", "*.tsbuildinfo", "next-env.d.ts", ".env*"]);
  });
});
