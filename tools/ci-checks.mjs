#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { main } from "./ci-checks/cli.mjs";

const args = process.argv.slice(2);
process.stdout.write(main(args, args.includes("--all") ? "" : readFileSync(0, "utf8")));
