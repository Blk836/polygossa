#!/usr/bin/env node

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { setUp } from "./stripe-setup/setup.mjs";

const run = promisify(execFile);
const AWS = process.platform === "win32" ? "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe" : "aws";
const AWS_ARGS = ["--profile", "polygossa", "--region", "eu-west-1"];
const KEY_SECRET = "polygossa/stripe-secret-key";
const WEBHOOK_SECRET = "polygossa/stripe-webhook-secret";

async function readSecret(name) {
  const { stdout } = await run(AWS, ["secretsmanager", "get-secret-value", "--secret-id", name,
    "--query", "SecretString", "--output", "text", ...AWS_ARGS]);
  return stdout.trim();
}

async function saveSecret(name, value) {
  try {
    await run(AWS, ["secretsmanager", "put-secret-value", "--secret-id", name, "--secret-string", value, ...AWS_ARGS]);
  } catch (e) {
    if (!String(e.stderr).includes("ResourceNotFoundException")) throw e;
    await run(AWS, ["secretsmanager", "create-secret", "--name", name, "--secret-string", value, ...AWS_ARGS]);
  }
}

const args = process.argv.slice(2);
const siteAt = args.indexOf("--site");
const site = siteAt >= 0 ? args[siteAt + 1] : "https://d3pd9mue4v7won.cloudfront.net";
try {
  await setUp({
    key: await readSecret(KEY_SECRET),
    site,
    fetch,
    saveWebhookSecret: (secret) => saveSecret(WEBHOOK_SECRET, secret),
    print: console.log,
    allowLive: args.includes("--live"),
  });
} catch (e) {
  console.error(e.message.replaceAll(/(sk|rk|whsec)_[A-Za-z0-9_]+/g, "$1_…"));
  process.exitCode = 1;
}
