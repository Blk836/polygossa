#!/usr/bin/env node
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { offenders, stripAll } from "./no-comments/repo.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
if (process.argv.includes("--fix")) stripAll(root);
const left = offenders(root);
console.log(left.length ? left.join("\n") : "No comments.");
process.exitCode = left.length ? 1 : 0;
