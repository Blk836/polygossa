import { test } from "node:test";
import assert from "node:assert/strict";
import { main } from "./cli.mjs";

test("reads the changed files and prints which checks run", () => {
  assert.equal(main([], "infra/lib/x.ts\ntools/a.mjs\n"),
    "backend=false\ne2e=false\nfrontend=false\ninfra=true\ntools=true\n");
});

test("--all runs everything, whatever was read", () => {
  assert.equal(main(["--all"], "infra/lib/x.ts\n"), "backend=true\ne2e=true\nfrontend=true\ninfra=true\ntools=true\n");
});
