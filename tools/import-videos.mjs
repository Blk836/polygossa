#!/usr/bin/env node

import { setTimeout as sleep } from "node:timers/promises";
import { main } from "./import-videos/cli.mjs";

process.exitCode = await main(process.argv.slice(2), { env: process.env, print: console.log, sleep });
