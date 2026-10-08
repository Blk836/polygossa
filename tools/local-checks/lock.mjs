// One heavy run on the PC at a time, across every session and worktree (docs/acceptance/local-checks.feature).
// The lock is a file created exclusively ("wx"), so of several runs trying at once exactly one gets it. It records
// who holds it, so a waiting run can say whom it waits for, and a lock whose process has died can be taken over.
import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs";
import { randomUUID } from "node:crypto";

/**
 * Waits for the lock, then holds it.
 * @param {string} path the lock file
 * @param {{pid: number}} holder who is taking it (pid, branch, folder, started)
 * @param {{isAlive(pid: number): boolean, sleep(): Promise<void>, onWait(holder): void, onTakeover(holder): void}} opts
 * @returns {Promise<() => void>} releases the lock
 */
export async function acquire(path, holder, { isAlive, sleep, onWait, onTakeover }) {
  const token = randomUUID();
  let waitingFor = null;
  for (;;) {
    if (tryCreate(path, JSON.stringify({ token, holder }))) return () => release(path, token);
    const current = read(path);
    if (current && !isAlive(current.holder.pid)) {
      if (takeOver(path, current, isAlive)) onTakeover(current.holder);
      else await sleep();
      continue;
    }
    if (current && current.token !== waitingFor) {
      waitingFor = current.token;
      onWait(current.holder);
    }
    await sleep();
  }
}

function tryCreate(path, content) {
  let fd;
  try {
    fd = openSync(path, "wx");
  } catch (error) {
    if (error.code === "EEXIST") return false;
    throw error;
  }
  try {
    writeSync(fd, content);
  } finally {
    closeSync(fd);
  }
  return true;
}

/** The lock's contents, or null when it is gone or not readable yet (being written). */
function read(path) {
  try {
    const lock = JSON.parse(readFileSync(path, "utf8"));
    return typeof lock?.token === "string" && typeof lock.holder?.pid === "number" ? lock : null;
  } catch {
    return null;
  }
}

/**
 * Removes a dead holder's lock, under a second lock so two runs finding the same dead lock can't remove a lock the
 * other has just taken. True when this run removed it.
 */
function takeOver(path, dead, isAlive) {
  const guard = `${path}.takeover`;
  if (!tryCreate(guard, JSON.stringify({ token: randomUUID(), holder: { pid: process.pid } }))) {
    const other = read(guard);
    if (other && !isAlive(other.holder.pid)) remove(guard);
    return false;
  }
  try {
    if (read(path)?.token !== dead.token) return false;
    remove(path);
    return true;
  } finally {
    remove(guard);
  }
}

function release(path, token) {
  if (read(path)?.token === token) remove(path);
}

function remove(path) {
  try {
    unlinkSync(path);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
