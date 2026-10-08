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
