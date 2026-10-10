#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { awsCli } from "./aws-signin/cli.mjs";
import { checkSignIn } from "./aws-signin/signin.mjs";

const PROFILE = "polygossa";
const cliPath = process.env.AWS_CLI ?? "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe";

process.exitCode = await checkSignIn({
  ...awsCli({ cliPath, profile: PROFILE, spawnSync, existsSync }),
  cliPath,
  expectedAccount: "788826923437",
  profile: PROFILE,
  log: (line) => console.log(line),
});
