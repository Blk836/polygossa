// Regression: the first deploy from the PC (tools/local-deploy.mjs) failed building the backend image with
// "./gradlew: not found". Git on Windows checked gradlew out with CRLF line endings, and Linux in Docker can't run a
// shell script whose first line ends in "\r". Files run inside Linux images must always be checked out with LF.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("gradlew is always checked out with LF line endings, whatever the PC's Git settings", () => {
  const attributes = execFileSync("git", ["check-attr", "eol", "gradlew"], { cwd: root, encoding: "utf8" });
  assert.equal(attributes.trim(), "gradlew: eol: lf");
});

// Git doesn't rewrite an unchanged file when the attributes change, so a checkout made before them (like the deploy
// tool's own) keeps CRLF: the image build strips it before running gradlew.
test("the backend image strips CRLF from gradlew before running it", async () => {
  const { readFileSync } = await import("node:fs");
  const steps = readFileSync(join(root, "backend", "Dockerfile"), "utf8").split(/\r?\n/);
  const strip = steps.findIndex((line) => line.startsWith("RUN sed -i 's/\\r$//' gradlew"));
  const firstRun = steps.findIndex((line) => line.startsWith("RUN ./gradlew"));
  assert.ok(strip >= 0 && strip < firstRun, "a CR-stripping step must come before the first gradlew run");
});
