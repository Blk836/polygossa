import { test } from "node:test";
import assert from "node:assert/strict";
import { runChecks } from "./run.mjs";

const SHA = "abc123";

function world(overrides = {}) {
  const calls = { plan: [], exec: [], status: [], locks: [], released: 0, log: [] };
  const suites = overrides.suites ?? [
    { name: "tools", steps: [{ command: "tools-test" }] },
    { name: "backend", steps: [{ command: "gradle" }] },
  ];
  let clock = 0;
  const deps = {
    git: {
      isClean: () => true, head: () => SHA, branch: () => "feat/x", folder: "/work/x",
      changedFiles: () => ["backend/A.java"], hasMain: () => true, ...overrides.git,
    },
    plan: (checks) => { calls.plan.push(checks); return checks.backend || checks.tools ? suites : []; },
    lock: async (info) => { calls.locks.push(info); return () => { calls.released++; }; },
    exec: async (step) => { calls.exec.push(step.command); clock += 2000; return overrides.fails?.includes(step.command) ? 1 : 0; },
    postStatus: async (sha, state, description) => { calls.status.push({ sha, state, description }); return null; },
    log: (line) => calls.log.push(line),
    now: () => clock,
    pid: 4242,
    started: "2026-10-08T10:00:00Z",
    ...overrides.deps,
  };
  return { deps, calls, output: () => calls.log.join("\n") };
}

test("uncommitted changes: refuses, says why, and runs nothing", async () => {
  const { deps, calls, output } = world({ git: { isClean: () => false } });
  assert.equal(await runChecks([], deps), 2);
  assert.match(output(), /uncommitted/i);
  assert.deepEqual([calls.locks.length, calls.exec.length, calls.status.length], [0, 0, 0]);
});

test("the checks are picked from the branch's changes against main", async () => {
  const { deps, calls } = world({ git: { changedFiles: () => ["infra/lib/x.ts"] } });
  await runChecks([], deps);
  assert.deepEqual(calls.plan[0], { backend: false, e2e: false, frontend: false, images: false, infra: true, tools: true });
});

test("--all, or changes that can't be listed, pick every check", async () => {
  for (const [args, files] of [[["--all"], ["infra/x.ts"]], [[], null]]) {
    const { deps, calls } = world({ git: { changedFiles: () => files } });
    await runChecks(args, deps);
    assert.deepEqual(calls.plan[0], { backend: true, e2e: true, frontend: true, images: true, infra: true, tools: true });
  }
});

test("all green: takes the lock as this run, releases it, marks the commit green and exits 0", async () => {
  const { deps, calls, output } = world();
  assert.equal(await runChecks([], deps), 0);
  assert.deepEqual(calls.locks, [{ pid: 4242, branch: "feat/x", folder: "/work/x", started: "2026-10-08T10:00:00Z" }]);
  assert.equal(calls.released, 1);
  assert.deepEqual(calls.exec, ["tools-test", "gradle"]);
  assert.deepEqual(calls.status, [{ sha: SHA, state: "success", description: "Passed: tools, backend" }]);
  assert.match(output(), /tools\s+passed\s+2s/);
  assert.match(output(), /backend\s+passed\s+2s/);
});

test("a failing suite doesn't stop the others; the commit is marked red naming it, exit 1", async () => {
  const { deps, calls, output } = world({ fails: ["tools-test"] });
  assert.equal(await runChecks([], deps), 1);
  assert.deepEqual(calls.exec, ["tools-test", "gradle"]);
  assert.deepEqual(calls.status, [{ sha: SHA, state: "failure", description: "Failed: tools (passed: backend)" }]);
  assert.match(output(), /tools\s+FAILED/);
});

test("within a suite, every step runs after a failed one, except after a failed install", async () => {
  const suites = [
    { name: "frontend", steps: [{ command: "unit" }, { command: "lint" }] },
    { name: "infra", steps: [{ command: "install", required: true }, { command: "synth" }] },
  ];
  const { deps, calls } = world({ suites, fails: ["unit", "install"], git: { changedFiles: () => null } });
  await runChecks([], deps);
  assert.deepEqual(calls.exec, ["unit", "lint", "install"]);
  assert.equal(calls.status[0].description, "Failed: frontend, infra");
});

test("docs only: nothing runs, no lock is needed, and the commit is marked green", async () => {
  const { deps, calls } = world({ git: { changedFiles: () => ["docs/a.md"] } });
  assert.equal(await runChecks([], deps), 0);
  assert.deepEqual([calls.locks.length, calls.exec.length], [0, 0]);
  assert.deepEqual(calls.status, [{ sha: SHA, state: "success", description: "Nothing to check (docs and Markdown only)" }]);
});

test("the commit changed during the run: no mark, says the run is out of date, exit 1", async () => {
  let reads = 0;
  const { deps, calls, output } = world({ git: { head: () => (reads++ === 0 ? SHA : "def456") } });
  assert.equal(await runChecks([], deps), 1);
  assert.deepEqual(calls.status, []);
  assert.match(output(), /out of date/i);
});

test("files changed during the run: no mark either", async () => {
  let reads = 0;
  const { deps, calls } = world({ git: { isClean: () => reads++ === 0 } });
  assert.equal(await runChecks([], deps), 1);
  assert.deepEqual(calls.status, []);
});

test("the mark can't be recorded (commit not pushed): says to push and run again, exit 1", async () => {
  const { deps, output } = world({ deps: { postStatus: async () => "No commit found for SHA" } });
  assert.equal(await runChecks([], deps), 1);
  assert.match(output(), /could not be recorded/i);
  assert.match(output(), /push/i);
});

test("the lock is released even when a suite crashes", async () => {
  const { deps, calls } = world({ deps: { exec: async () => { throw new Error("spawn failed"); } } });
  await assert.rejects(runChecks([], deps));
  assert.equal(calls.released, 1);
});

test("main has moved past the branch: still marked, with a warning to catch up before merging", async () => {
  const { deps, calls, output } = world({ git: { hasMain: () => false } });
  assert.equal(await runChecks([], deps), 0);
  assert.equal(calls.status.length, 1);
  assert.match(output(), /main has moved/i);
});

test("--run: one command takes its turn, keeps its exit code, and marks nothing", async () => {
  const { deps, calls } = world({ fails: ["gradlew.bat :backend:test --tests X"] });
  assert.equal(await runChecks(["--run", "--", "gradlew.bat", ":backend:test", "--tests", "X"], deps), 1);
  assert.equal(calls.locks.length, 1);
  assert.equal(calls.released, 1);
  assert.deepEqual(calls.exec, ["gradlew.bat :backend:test --tests X"]);
  assert.deepEqual(calls.status, []);
});

test("--run runs the command in the folder it was started from", async () => {
  const { deps } = world();
  const steps = [];
  deps.here = "frontend";
  deps.exec = async (step) => { steps.push(step); return 0; };
  await runChecks(["--run", "--", "npx", "playwright", "test"], deps);
  assert.deepEqual(steps, [{ command: "npx playwright test", cwd: "frontend" }]);
});

test("--run works with uncommitted changes (it marks nothing)", async () => {
  const { deps } = world({ git: { isClean: () => false } });
  assert.equal(await runChecks(["--run", "--", "npm", "test"], deps), 0);
});

test("--run without a command: says how to use it, exit 2", async () => {
  const { deps, calls, output } = world();
  assert.equal(await runChecks(["--run"], deps), 2);
  assert.match(output(), /--run -- <command>/);
  assert.equal(calls.locks.length, 0);
});
