// A local run of the checks (docs/acceptance/local-checks.feature): refuse uncommitted work, pick the suites from the
// branch's changes against main, run them in the PC's single turn (the lock), and mark the commit on GitHub.
import { ALL, checksFor } from "../ci-checks/checks.mjs";

const USAGE = "Usage: node tools/local-checks.mjs [--all] | --run -- <command>";

/** @returns {Promise<number>} the exit code */
export async function runChecks(args, deps) {
  return args.includes("--run") ? runOne(args, deps) : runSuites(args, deps);
}

async function runOne(args, deps) {
  const command = args.slice(args.indexOf("--") + 1).join(" ");
  if (!args.includes("--") || !command) {
    deps.log(`${USAGE}\n  (--run -- <command> runs one heavy command in its turn)`);
    return 2;
  }
  return inTurn(deps, () => deps.exec({ command, cwd: deps.here ?? "." }));
}

async function runSuites(args, deps) {
  const { git, log } = deps;
  if (!git.isClean()) {
    log("Refusing to start: the working copy has uncommitted or untracked changes, so the result would not describe"
      + " any commit. Commit them (or set them aside) first.");
    return 2;
  }
  const sha = git.head();
  const files = args.includes("--all") ? null : git.changedFiles();
  const plan = deps.plan(files === null ? Object.fromEntries(ALL.map((c) => [c, true])) : checksFor(files));
  const results = plan.length ? await inTurn(deps, () => runPlan(plan, deps)) : [];
  log(results.length ? "\nLocal checks:" : "Local checks: nothing to check (docs and Markdown only).");
  results.forEach(({ name, passed, ms }) => log(`  ${name.padEnd(9)} ${passed ? "passed" : "FAILED"} ${seconds(ms)}`));
  if (git.head() !== sha || !git.isClean()) {
    log(`The run is out of date: the commit or files changed while it ran, so ${sha} was not marked. Run it again.`);
    return 1;
  }
  return mark(sha, results, deps);
}

async function mark(sha, results, deps) {
  const passed = results.every((r) => r.passed);
  const error = await deps.postStatus(sha, passed ? "success" : "failure", describe(results));
  if (error) {
    deps.log(`The result could not be recorded on GitHub (${error}). Push the commit, then run the checks again.`);
    return 1;
  }
  deps.log(`Marked ${sha} on GitHub: local checks ${passed ? "passed" : "failed"}.`);
  if (!deps.git.hasMain()) {
    deps.log("Note: main has moved since this branch last caught up. Before merging, merge main in and run again.");
  }
  return passed ? 0 : 1;
}

/** Runs `work` holding the PC's turn, saying whom it waits for, and always gives the turn back. */
async function inTurn(deps, work) {
  const release = await deps.lock({ pid: deps.pid, branch: deps.git.branch(), folder: deps.git.folder,
    started: deps.started });
  try {
    return await work();
  } finally {
    release();
  }
}

async function runPlan(plan, deps) {
  const results = [];
  for (const suite of plan) {
    const start = deps.now();
    const passed = await runSteps(suite.steps, deps);
    results.push({ name: suite.name, passed, ms: deps.now() - start });
  }
  return results;
}

/** Every step runs even after one failed (to show every problem), except after a failed required one (an install). */
async function runSteps(steps, deps) {
  let passed = true;
  for (const step of steps) {
    const ok = (await deps.exec(step)) === 0;
    passed &&= ok;
    if (!ok && step.required) break;
  }
  return passed;
}

/** The mark's description (GitHub allows 140 characters). */
function describe(results) {
  if (!results.length) return "Nothing to check (docs and Markdown only)";
  const names = (passed) => results.filter((r) => r.passed === passed).map((r) => r.name).join(", ");
  const failed = names(false);
  if (!failed) return `Passed: ${names(true)}`;
  const passed = names(true);
  return (passed ? `Failed: ${failed} (passed: ${passed})` : `Failed: ${failed}`).slice(0, 140);
}

function seconds(ms) {
  return `${Math.round(ms / 1000)}s`;
}
