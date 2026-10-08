import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { acquire } from "./lock.mjs";

const lockPath = () => join(mkdtempSync(join(tmpdir(), "local-checks-")), "checks.lock");
const holder = (pid, branch = "feat/a") => ({ pid, branch, folder: `/work/${branch}`, started: "2026-10-08T10:00:00Z" });
const alive = (...pids) => (pid) => pids.includes(pid);
const tick = () => new Promise((resolve) => setImmediate(resolve));
const quiet = { sleep: tick, onWait() {}, onTakeover() {} };

test("a free lock is taken at once and records who holds it", async () => {
  const path = lockPath();
  const release = await acquire(path, holder(1), { ...quiet, isAlive: alive(1) });
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")).holder, holder(1));
  release();
  assert.equal(existsSync(path), false);
});

test("a second run waits, says whom for, and starts once the first releases", async () => {
  const path = lockPath();
  const releaseFirst = await acquire(path, holder(1, "feat/first"), { ...quiet, isAlive: alive(1, 2) });
  const waits = [];
  let started = false;
  const second = acquire(path, holder(2, "feat/second"), {
    ...quiet, isAlive: alive(1, 2), onWait: (h) => waits.push(h),
  }).then((release) => { started = true; return release; });
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(started, false);
  assert.deepEqual(waits[0], holder(1, "feat/first"));
  assert.equal(waits.length, 1, "says it once, not on every poll");
  releaseFirst();
  const releaseSecond = await second;
  assert.equal(JSON.parse(readFileSync(path, "utf8")).holder.branch, "feat/second");
  releaseSecond();
});

test("when the holder finishes, exactly one of two waiting runs starts", async () => {
  const path = lockPath();
  const releaseFirst = await acquire(path, holder(1), { ...quiet, isAlive: alive(1, 2, 3) });
  const started = [];
  const opts = { ...quiet, isAlive: alive(1, 2, 3) };
  const b = acquire(path, holder(2, "b"), opts).then((r) => { started.push("b"); return r; });
  const c = acquire(path, holder(3, "c"), opts).then((r) => { started.push("c"); return r; });
  releaseFirst();
  for (let i = 0; i < 10; i++) await tick();
  assert.equal(started.length, 1);
  const releaseWinner = await (started[0] === "b" ? b : c);
  releaseWinner();
  await (started[0] === "b" ? c : b).then((r) => r());
  assert.equal(started.length, 2);
});

test("a lock left by a process that no longer exists is taken over, saying whose it was", async () => {
  const path = lockPath();
  writeFileSync(path, JSON.stringify({ token: "old", holder: holder(99, "feat/crashed") }));
  const takenFrom = [];
  const release = await acquire(path, holder(2), { ...quiet, isAlive: alive(2), onTakeover: (h) => takenFrom.push(h) });
  assert.deepEqual(takenFrom, [holder(99, "feat/crashed")]);
  assert.equal(JSON.parse(readFileSync(path, "utf8")).holder.pid, 2);
  release();
});

test("two runs finding the same dead lock: one takes it, the other waits for that one", async () => {
  const path = lockPath();
  writeFileSync(path, JSON.stringify({ token: "old", holder: holder(99) }));
  const opts = { ...quiet, isAlive: alive(2, 3) };
  const started = [];
  const b = acquire(path, holder(2, "b"), opts).then((r) => { started.push("b"); return r; });
  const c = acquire(path, holder(3, "c"), opts).then((r) => { started.push("c"); return r; });
  for (let i = 0; i < 10; i++) await tick();
  assert.equal(started.length, 1);
  (await (started[0] === "b" ? b : c))();
  (await (started[0] === "b" ? c : b))();
});

test("an unreadable lock file (half written) is waited on, not taken over", async () => {
  const path = lockPath();
  writeFileSync(path, "{");
  let started = false;
  const run = acquire(path, holder(2), { ...quiet, isAlive: alive(2) }).then((r) => { started = true; return r; });
  for (let i = 0; i < 5; i++) await tick();
  assert.equal(started, false);
  writeFileSync(path, JSON.stringify({ token: "old", holder: holder(99) }));
  (await run)();
});

test("releasing doesn't remove a lock that is no longer ours", async () => {
  const path = lockPath();
  const release = await acquire(path, holder(1), { ...quiet, isAlive: alive(1) });
  writeFileSync(path, JSON.stringify({ token: "someone-else", holder: holder(2) }));
  release();
  assert.equal(JSON.parse(readFileSync(path, "utf8")).holder.pid, 2);
});

test("releasing twice is harmless", async () => {
  const path = lockPath();
  const release = await acquire(path, holder(1), { ...quiet, isAlive: alive(1) });
  release();
  release();
  assert.equal(existsSync(path), false);
});
