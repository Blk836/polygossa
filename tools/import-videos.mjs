#!/usr/bin/env node
// Bulk-imports curated YouTube videos into the community library. See tools/README.md, or run with no arguments.

import { setTimeout as sleep } from "node:timers/promises";
import { main } from "./import-videos/cli.mjs";

process.exitCode = await main(process.argv.slice(2), { env: process.env, print: console.log, sleep });
