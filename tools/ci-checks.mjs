#!/usr/bin/env node
// Used by CI: which checks a pull request needs (tools/ci-checks/checks.mjs). Reads the changed files on stdin.
//   git diff --name-only HEAD^1 HEAD | node tools/ci-checks.mjs >> "$GITHUB_OUTPUT"
//   node tools/ci-checks.mjs --all >> "$GITHUB_OUTPUT"
import { readFileSync } from "node:fs";
import { main } from "./ci-checks/cli.mjs";

const args = process.argv.slice(2);
process.stdout.write(main(args, args.includes("--all") ? "" : readFileSync(0, "utf8")));
