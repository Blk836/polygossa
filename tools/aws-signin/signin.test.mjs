import { test } from "node:test";
import assert from "node:assert/strict";
import { checkSignIn } from "./signin.mjs";

const EXPECTED = "788826923437";

function world({ exists = true, answers = [], login = { code: 0 } } = {}) {
  const calls = { account: 0, login: 0, log: [] };
  const deps = {
    cliPath: "C:\\aws.exe",
    cliExists: () => exists,
    account: async () => answers[calls.account++] ?? {},
    login: async () => { calls.login++; return login; },
    expectedAccount: EXPECTED,
    profile: "polygossa",
    log: (line) => calls.log.push(line),
  };
  return { deps, calls, text: () => calls.log.join("\n") };
}

test("signed in to the app account: passes without opening the browser", async () => {
  const w = world({ answers: [{ account: EXPECTED }] });
  assert.equal(await checkSignIn(w.deps), 0);
  assert.equal(w.calls.login, 0);
  assert.match(w.text(), /signed in to account 788826923437/);
});

test("missing or expired: opens the sign-in, and passes once it succeeds", async () => {
  const w = world({ answers: [{ failed: true }, { account: EXPECTED }] });
  assert.equal(await checkSignIn(w.deps), 0);
  assert.equal(w.calls.login, 1);
  assert.match(w.text(), /missing or expired/);
  assert.match(w.text(), /dream it ship it/);
  assert.match(w.text(), /signed in to account 788826923437/);
});

test("the sign-in fails or is cancelled: stops, and says how to retry", async () => {
  const w = world({ answers: [{ failed: true }, { failed: true }], login: { code: 1 } });
  assert.equal(await checkSignIn(w.deps), 1);
  assert.match(w.text(), /didn't complete/);
  assert.match(w.text(), /aws login --profile polygossa/);
});

test("the sign-in isn't finished within 5 minutes: stops without checking again", async () => {
  const w = world({ answers: [{ failed: true }], login: { timedOut: true } });
  assert.equal(await checkSignIn(w.deps), 1);
  assert.equal(w.calls.account, 1);
  assert.match(w.text(), /didn't complete within 5 minutes/);
});

test("the wrong account was picked while signing in: stops and names the account expected", async () => {
  const w = world({ answers: [{ failed: true }, { failed: true }], login: { code: 1 } });
  assert.equal(await checkSignIn(w.deps), 1);
  assert.match(w.text(), /788826923437/);
});

test("signed in to another account already: stops without opening the browser, naming both", async () => {
  const w = world({ answers: [{ account: "111122223333" }] });
  assert.equal(await checkSignIn(w.deps), 1);
  assert.equal(w.calls.login, 0);
  assert.match(w.text(), /111122223333, not 788826923437/);
});

test("the AWS CLI is missing: stops and says where it looked", async () => {
  const w = world({ exists: false });
  assert.equal(await checkSignIn(w.deps), 1);
  assert.equal(w.calls.account, 0);
  assert.match(w.text(), /AWS CLI not found at C:\\aws\.exe/);
});

test("the account check hangs: stops and says it timed out, without opening the browser", async () => {
  const w = world({ answers: [{ timedOut: true }] });
  assert.equal(await checkSignIn(w.deps), 1);
  assert.equal(w.calls.login, 0);
  assert.match(w.text(), /timed out/);
});
