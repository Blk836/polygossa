#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { acquire } from "./local-checks/lock.mjs";
import { runDeploy } from "./local-deploy/deploy.mjs";

const WIN = process.platform === "win32";
const PROFILE = "polygossa";
const STATUS = "deploy production";
const found = (path, fallback) => (WIN && existsSync(path) ? path : fallback);
const GH = process.env.GH ?? found("C:\\Program Files\\GitHub CLI\\gh.exe", "gh");
const AWS = process.env.AWS_CLI ?? found("C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe", "aws");
const DOCKER_BIN = join(homedir(), "AppData", "Local", "Programs", "DockerDesktop", "resources", "bin");
const PATH = existsSync(DOCKER_BIN) ? `${process.env.PATH}${delimiter}${DOCKER_BIN}` : process.env.PATH;

const run = (program, args, options = {}) =>
  execFileSync(program, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...options }).trim();
const git = (...args) => run("git", args);
const tryRun = (fn) => { try { return fn(); } catch { return null; } };
const root = git("rev-parse", "--show-toplevel");
const common = resolve(root, git("rev-parse", "--git-common-dir"));
const copy = join(common, "polygossa-deploy");
let signedInAccount = null;

function exec(command, cwd, env = process.env) {
  console.log(`\n> (${cwd}) ${command}`);
  return new Promise((done) => {
    const child = spawn(command, { cwd, shell: true, stdio: "inherit", env });
    child.on("error", () => done(1));
    child.on("exit", (code) => done(code ?? 1));
  });
}

function credentials() {
  const lines = run(AWS, ["configure", "export-credentials", "--profile", PROFILE, "--format", "env-no-export"]);
  return Object.fromEntries(lines.split(/\r?\n/).map((line) => line.split(/=(.*)/s).slice(0, 2)));
}

async function prepare(sha) {
  const ok = existsSync(copy)
    ? tryRun(() => { git("-C", copy, "checkout", "--detach", "--force", sha); git("-C", copy, "clean", "-fdq"); return true; })
    : tryRun(() => { git("worktree", "add", "--detach", copy, sha); return true; });
  if (!ok) return false;
  const installed = join(copy, "infra", "node_modules", ".package-lock.json");
  const fresh = existsSync(installed)
    && statSync(installed).mtimeMs >= statSync(join(copy, "infra", "package-lock.json")).mtimeMs;
  return fresh || (await exec("npm ci", join(copy, "infra"))) === 0;
}

function uploadsBucket() {
  const query = "StackResources[?ResourceType=='AWS::S3::Bucket' && starts_with(LogicalResourceId, 'Uploads')]"
    + ".PhysicalResourceId";
  return tryRun(() => run(AWS, ["cloudformation", "describe-stack-resources", "--stack-name", "PolygossaStaging",
    "--profile", PROFILE, "--region", "eu-west-1", "--query", query, "--output", "text"])) || null;
}

function liveState() {
  let outputs;
  try {
    outputs = JSON.parse(run(AWS, ["cloudformation", "describe-stacks", "--stack-name", "PolygossaStaging",
      "--profile", PROFILE, "--region", "eu-west-1", "--query", "Stacks[0].Outputs", "--output", "json"])) ?? [];
  } catch (error) {
    if (/does not exist/.test(String(error.stderr))) return null;
    throw error;
  }
  const value = (key) => outputs.find((o) => o.OutputKey === key)?.OutputValue;
  return { paused: value("Paused") === "true", databaseSnapshot: value("DatabaseSnapshot") ?? "none" };
}

function plannedState() {
  const { context } = JSON.parse(readFileSync(join(copy, "infra", "cdk.json"), "utf8"));
  return { paused: context.paused === true, databaseSnapshot: context["database-snapshot"] ?? "none" };
}

async function liveChecks() {
  const bucket = uploadsBucket();
  if (!bucket || /\s/.test(bucket)) {
    console.log(`The uploads bucket of PolygossaStaging couldn't be found (got: ${bucket ?? "nothing"}).`);
    return false;
  }
  const jdk = join(homedir(), ".jdks", "openjdk-26.0.1");
  const env = { ...process.env, ...credentials(), AWS_REGION: "eu-west-1", LIVE_S3_BUCKET: bucket };
  if (!env.JAVA_HOME && existsSync(jdk)) env.JAVA_HOME = jdk;
  return (await exec(`${WIN ? ".\\gradlew.bat" : "./gradlew"} --no-daemon :backend:liveTest`, copy, env)) === 0;
}

async function deploy() {
  const env = { ...process.env, ...credentials(), PATH, AWS_REGION: "eu-west-1", CDK_DEFAULT_REGION: "eu-west-1",
    CDK_DEFAULT_ACCOUNT: signedInAccount };
  const outputs = join(copy, "infra", "cdk.out", "deploy-outputs.json");
  const code = await exec("npx cdk deploy PolygossaStaging PolygossaQa --require-approval never --progress events"
    + ` --outputs-file "${outputs}"`, join(copy, "infra"), env);
  const stack = tryRun(() => JSON.parse(readFileSync(outputs, "utf8")).PolygossaStaging);
  return { ok: code === 0 && Boolean(stack?.SiteUrl), siteUrl: stack?.SiteUrl, paused: stack?.Paused === "true" };
}

function deployState(sha) {
  return tryRun(() => run(GH, ["api", `repos/{owner}/{repo}/commits/${sha}/statuses`,
    "--jq", `[.[] | select(.context == "${STATUS}")][0].state // ""`], { cwd: root })) || null;
}

function postStatus(sha, state, description) {
  try {
    run(GH, ["api", "--silent", `repos/{owner}/{repo}/statuses/${sha}`, "-f", `state=${state}`,
      "-f", `context=${STATUS}`, "-f", `description=${description.slice(0, 140)}`], { cwd: root });
    return null;
  } catch (error) {
    return String(error.stderr || error.message).trim().split("\n")[0];
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

let releaseOnExit = () => {};
process.on("SIGINT", () => {
  releaseOnExit();
  process.exit(130);
});

const describeHolder = (h) => `${h.branch} (${h.folder}, pid ${h.pid}), started ${h.started}`;

process.exitCode = await runDeploy(process.argv.slice(2), {
  account: async () => (signedInAccount = tryRun(() => run(AWS, ["sts", "get-caller-identity", "--profile", PROFILE,
    "--query", "Account", "--output", "text"]))),
  expectedAccount: process.env.CDK_DEFAULT_ACCOUNT ?? tryRun(() => run(GH, ["variable", "get", "AWS_ACCOUNT_ID"], { cwd: root })),
  dockerRunning: async () => tryRun(() => run("docker", ["info"], { env: { ...process.env, PATH } })) !== null,
  mainSha: async () => { git("fetch", "--quiet", "origin", "main"); return git("rev-parse", "origin/main"); },
  deployState: async (sha) => deployState(sha),
  lock: async (holder) => {
    const release = await acquire(join(common, "polygossa-checks.lock"), holder, {
      isAlive,
      sleep: () => new Promise((wake) => setTimeout(wake, 3000)),
      onWait: (h) => console.log(`Waiting for the PC's turn: ${describeHolder(h)} is running.`),
      onTakeover: (h) => console.log(`Took over the turn from a run that no longer exists: ${describeHolder(h)}.`),
    });
    releaseOnExit = release;
    return release;
  },
  prepare,
  liveState: async () => liveState(),
  plannedState: async () => plannedState(),
  liveChecks,
  deploy,
  fetch: (url) => fetch(url, { signal: AbortSignal.timeout(20_000) }),
  sleep: () => new Promise((wake) => setTimeout(wake, 15_000)),
  postStatus: async (sha, state, description) => postStatus(sha, state, description),
  log: (line) => console.log(line),
  now: () => Date.now(),
  pid: process.pid,
  branch: "deploy of main",
  folder: copy,
  started: new Date().toISOString(),
});
