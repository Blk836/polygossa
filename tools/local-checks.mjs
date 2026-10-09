#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { acquire } from "./local-checks/lock.mjs";
import { runChecks } from "./local-checks/run.mjs";
import { suitesFor } from "./local-checks/suites.mjs";

const WIN = process.platform === "win32";
const GH_WINDOWS = "C:\\Program Files\\GitHub CLI\\gh.exe";
const GH = process.env.GH ?? (WIN && existsSync(GH_WINDOWS) ? GH_WINDOWS : "gh");

const git = (...args) => execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const succeeds = (fn) => { try { fn(); return true; } catch { return false; } };
const root = git("rev-parse", "--show-toplevel");

const repo = {
  isClean: () => git("status", "--porcelain") === "",
  head: () => git("rev-parse", "HEAD"),
  branch: () => git("rev-parse", "--abbrev-ref", "HEAD"),
  folder: root,
  changedFiles() {
    try {
      git("fetch", "--quiet", "origin", "main");
      return git("diff", "--name-only", "origin/main...HEAD").split("\n").filter(Boolean);
    } catch {
      return null;
    }
  },
  hasMain: () => succeeds(() => git("merge-base", "--is-ancestor", "origin/main", "HEAD")),
};

function needsInstall(dir) {
  const installed = join(root, dir, "node_modules", ".package-lock.json");
  return !existsSync(installed) || statSync(installed).mtimeMs < statSync(join(root, dir, "package-lock.json")).mtimeMs;
}

function cdkAccount() {
  if (process.env.CDK_DEFAULT_ACCOUNT) return process.env.CDK_DEFAULT_ACCOUNT;
  try {
    return execFileSync(GH, ["variable", "get", "AWS_ACCOUNT_ID"], { encoding: "utf8", cwd: root }).trim();
  } catch {
    return undefined;
  }
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function exec(step) {
  const env = { ...process.env };
  for (const [key, value] of Object.entries(step.env ?? {})) if (value !== undefined) env[key] = value;
  console.log(`\n> ${step.cwd === "." ? "" : `(${step.cwd}) `}${step.command}`);
  return new Promise((done, fail) => {
    const child = spawn(step.command, { cwd: join(root, step.cwd), shell: true, stdio: "inherit", env });
    child.on("error", fail);
    child.on("exit", (code) => done(code ?? 1));
  });
}

function postStatus(sha, state, description) {
  try {
    execFileSync(GH, ["api", "--silent", `repos/{owner}/{repo}/statuses/${sha}`, "-f", `state=${state}`,
      "-f", "context=local checks", "-f", `description=${description}`], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
    return null;
  } catch (error) {
    return String(error.stderr || error.message).trim().split("\n")[0];
  }
}

let releaseOnExit = () => {};
process.on("SIGINT", () => {
  releaseOnExit();
  process.exit(130);
});

const lockPath = join(resolve(root, git("rev-parse", "--git-common-dir")), "polygossa-checks.lock");
const describeHolder = (h) => `${h.branch} (${h.folder}, pid ${h.pid}), started ${h.started}`;

async function lock(holder) {
  const release = await acquire(lockPath, holder, {
    isAlive,
    sleep: () => new Promise((wake) => setTimeout(wake, 3000)),
    onWait: (h) => console.log(`Waiting for the PC's turn: local checks of ${describeHolder(h)} are running.`),
    onTakeover: (h) => console.log(`Took over the turn from a run that no longer exists: ${describeHolder(h)}.`),
  });
  releaseOnExit = release;
  return release;
}

process.exitCode = await runChecks(process.argv.slice(2), {
  git: repo,
  plan: (checks) => suitesFor(checks, { win: WIN, needsInstall, cdkAccount: checks.infra ? cdkAccount() : undefined }),
  lock,
  exec,
  postStatus,
  log: (line) => console.log(line),
  now: () => Date.now(),
  here: relative(root, process.cwd()) || ".",
  pid: process.pid,
  started: new Date().toISOString(),
});
