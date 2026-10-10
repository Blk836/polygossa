import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { offenders } from "./repo.mjs";

test("the repository has no comments (strip them with node tools/no-comments.mjs --fix)", () => {
  assert.deepEqual(offenders(join(dirname(fileURLToPath(import.meta.url)), "..", "..")), []);
});
