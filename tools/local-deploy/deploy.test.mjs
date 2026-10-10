import { test } from "node:test";
import assert from "node:assert/strict";
import { runDeploy } from "./deploy.mjs";

const MAIN = "main111";
const ACCOUNT = "123456789012";
const SITE = "https://abc.cloudfront.net";

function world(overrides = {}) {
  const calls = { order: [], status: [], locks: [], released: 0, prepared: [], fetched: [], log: [] };
  let clock = 0;
  const deps = {
    account: async () => { calls.order.push("account"); return ACCOUNT; },
    expectedAccount: ACCOUNT,
    dockerRunning: async () => { calls.order.push("docker"); return true; },
    mainSha: async () => { calls.order.push("main"); return MAIN; },
    deployState: async () => null,
    lock: async (holder) => { calls.order.push("lock"); calls.locks.push(holder); return () => { calls.released++; }; },
    prepare: async (sha) => { calls.order.push("prepare"); calls.prepared.push(sha); return true; },
    deploy: async () => { calls.order.push("deploy"); clock += 300_000; return { ok: true, siteUrl: SITE }; },
    fetch: async (url) => {
      calls.fetched.push(url);
      return { ok: true, status: 200, text: async () => (url.endsWith("/api/languages") ? '[{"code":"es"}]' : "<html>") };
    },
    sleep: async () => { clock += 15_000; },
    postStatus: async (sha, state, description) => { calls.status.push({ sha, state, description }); return null; },
    log: (line) => calls.log.push(line),
    now: () => clock,
    pid: 4242,
    branch: "feat/x",
    folder: "/work/x",
    started: "2026-10-08T10:00:00Z",
    ...overrides,
  };
  return { deps, calls, output: () => calls.log.join("\n") };
}

const states = (calls) => calls.status.map((s) => s.state);

test("deploys the latest main from the deploy copy, in the PC's turn, and checks the site", async () => {
  const { deps, calls, output } = world();
  assert.equal(await runDeploy([], deps), 0);
  assert.deepEqual(calls.prepared, [MAIN]);
  assert.deepEqual(calls.order.slice(calls.order.indexOf("lock")), ["lock", "main", "prepare", "deploy"]);
  assert.deepEqual(calls.fetched, [`${SITE}/login`, `${SITE}/api/languages`]);
  assert.equal(calls.released, 1);
  assert.match(output(), new RegExp(MAIN));
  assert.match(output(), new RegExp(SITE.replaceAll(".", "\\.")));
  assert.match(output(), /5m/);
});

test("main's commit is marked pending, then green", async () => {
  const { deps, calls } = world();
  await runDeploy([], deps);
  assert.deepEqual(states(calls), ["pending", "success"]);
  assert.ok(calls.status.every((s) => s.sha === MAIN));
});

test("a main that is already deployed is not deployed again, and the turn is given back", async () => {
  const { deps, calls, output } = world({ deployState: async () => "success" });
  assert.equal(await runDeploy([], deps), 0);
  assert.match(output(), /already/i);
  assert.deepEqual([calls.prepared.length, calls.status.length, calls.released], [0, 0, 1]);
});

test("--again deploys a main that is already deployed", async () => {
  const { deps, calls } = world({ deployState: async () => "success" });
  assert.equal(await runDeploy(["--again"], deps), 0);
  assert.deepEqual(calls.prepared, [MAIN]);
});

test("a main whose last deploy failed or never finished is deployed", async () => {
  for (const state of ["failure", "pending", "error"]) {
    const { deps, calls } = world({ deployState: async () => state });
    await runDeploy([], deps);
    assert.deepEqual(calls.prepared, [MAIN], state);
  }
});

test("main is read once the turn is held, so a session that waited deploys what is on main by then", async () => {
  const { deps, calls } = world();
  await runDeploy([], deps);
  assert.equal(calls.order.filter((step) => step === "main").length, 1);
  assert.ok(calls.order.indexOf("main") > calls.order.indexOf("lock"));
});

test("expired or missing AWS sign-in: stops before anything, says how to sign in", async () => {
  const { deps, calls, output } = world({ account: async () => null });
  assert.equal(await runDeploy([], deps), 2);
  assert.match(output(), /aws login --profile polygossa/);
  assert.deepEqual([calls.locks.length, calls.prepared.length, calls.status.length], [0, 0, 0]);
});

test("the wrong AWS account: refuses, naming both", async () => {
  const { deps, calls, output } = world({ account: async () => "999999999999" });
  assert.equal(await runDeploy([], deps), 2);
  assert.match(output(), /999999999999/);
  assert.match(output(), new RegExp(ACCOUNT));
  assert.deepEqual([calls.locks.length, calls.status.length], [0, 0]);
});

test("the expected account unknown (no GitHub variable): the signed-in account is used", async () => {
  const { deps } = world({ expectedAccount: undefined });
  assert.equal(await runDeploy([], deps), 0);
});

test("Docker not running: stops before anything, says to start Docker Desktop", async () => {
  const { deps, calls, output } = world({ dockerRunning: async () => false });
  assert.equal(await runDeploy([], deps), 2);
  assert.match(output(), /Docker Desktop/);
  assert.deepEqual([calls.locks.length, calls.status.length], [0, 0]);
});

test("a failed cdk deploy: no site checks, red mark, error exit, turn given back", async () => {
  const { deps, calls, output } = world({ deploy: async () => ({ ok: false }) });
  assert.equal(await runDeploy([], deps), 1);
  assert.deepEqual(calls.fetched, []);
  assert.deepEqual(states(calls), ["pending", "failure"]);
  assert.match(output(), /fail/i);
  assert.equal(calls.released, 1);
});

test("the deploy copy can't be prepared: red mark, nothing deployed", async () => {
  let deployed = false;
  const { deps, calls } = world({ prepare: async () => false, deploy: async () => { deployed = true; return { ok: true }; } });
  assert.equal(await runDeploy([], deps), 1);
  assert.equal(deployed, false);
  assert.deepEqual(states(calls), ["pending", "failure"]);
});

test("the site is waited for: a few failed answers are retried", async () => {
  let tries = 0;
  const { deps, calls } = world({
    fetch: async (url) => {
      tries++;
      if (tries <= 3) throw new Error("connection refused");
      return { ok: tries > 5, status: tries > 5 ? 200 : 503, text: async () => '[{"code":"es"}]' };
    },
  });
  assert.equal(await runDeploy([], deps), 0);
  assert.equal(tries, 7);
  assert.deepEqual(states(calls), ["pending", "success"]);
});

test("a site that never answers: red mark after about five minutes of trying", async () => {
  let tries = 0;
  const { deps, calls, output } = world({ fetch: async () => { tries++; return { ok: false, status: 502, text: async () => "" }; } });
  assert.equal(await runDeploy([], deps), 1);
  assert.equal(tries, 20);
  assert.deepEqual(states(calls), ["pending", "failure"]);
  assert.match(output(), /sign-in page/i);
});

test("a backend that answers without languages: red mark", async () => {
  const { deps, calls, output } = world({
    sleep: async () => {},
    fetch: async (url) => ({ ok: true, status: 200, text: async () => (url.endsWith("/login") ? "<html>" : "<html>error</html>") }),
  });
  assert.equal(await runDeploy([], deps), 1);
  assert.deepEqual(states(calls), ["pending", "failure"]);
  assert.match(output(), /backend/i);
});

test("a mark that can't be recorded on GitHub doesn't fail the deploy, but is reported", async () => {
  const { deps, output } = world({ postStatus: async () => "HTTP 401" });
  assert.equal(await runDeploy([], deps), 0);
  assert.match(output(), /HTTP 401/);
});

test("an unknown argument: usage, nothing runs", async () => {
  const { deps, calls, output } = world();
  assert.equal(await runDeploy(["--now"], deps), 2);
  assert.match(output(), /Usage/);
  assert.deepEqual(calls.order, []);
});
