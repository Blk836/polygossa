import { test } from "node:test";
import assert from "node:assert/strict";
import { ACCOUNT_TIMEOUT_MS, awsCli, LOGIN_TIMEOUT_MS } from "./cli.mjs";

function cli(result) {
  const calls = [];
  const spawnSync = (program, args, options) => { calls.push({ program, args, options }); return result; };
  return { aws: awsCli({ cliPath: "aws.exe", profile: "polygossa", spawnSync, existsSync: () => true }), calls };
}

test("the account check asks STS for the profile's account, with a 30 second limit", async () => {
  const { aws, calls } = cli({ status: 0, stdout: "788826923437\r\n" });
  assert.deepEqual(await aws.account(), { account: "788826923437" });
  assert.deepEqual(calls[0].args, ["sts", "get-caller-identity", "--profile", "polygossa", "--query", "Account",
    "--output", "text"]);
  assert.equal(calls[0].options.timeout, ACCOUNT_TIMEOUT_MS);
  assert.equal(ACCOUNT_TIMEOUT_MS, 30_000);
});

test("an error or an odd answer from the account check counts as not signed in", async () => {
  assert.deepEqual(await cli({ status: 255, stdout: "" }).aws.account(), { failed: true });
  assert.deepEqual(await cli({ status: 0, stdout: "None" }).aws.account(), { failed: true });
});

test("a hung account check is reported as timed out", async () => {
  assert.deepEqual(await cli({ error: { code: "ETIMEDOUT" } }).aws.account(), { timedOut: true });
});

test("signing in answers n to switching the profile to another account, with a 5 minute limit", async () => {
  const { aws, calls } = cli({ status: 0 });
  assert.deepEqual(await aws.login(), { code: 0 });
  assert.deepEqual(calls[0].args, ["login", "--profile", "polygossa"]);
  assert.equal(calls[0].options.input, "n\n");
  assert.equal(calls[0].options.timeout, LOGIN_TIMEOUT_MS);
  assert.equal(LOGIN_TIMEOUT_MS, 300_000);
});

test("a sign-in left unfinished is reported as timed out", async () => {
  assert.deepEqual(await cli({ error: { code: "ETIMEDOUT" } }).aws.login(), { timedOut: true });
});
