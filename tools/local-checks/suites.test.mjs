import { test } from "node:test";
import assert from "node:assert/strict";
import { suitesFor } from "./suites.mjs";

const none = { backend: false, e2e: false, frontend: false, images: false, infra: false, tools: false };
const all = { backend: true, e2e: true, frontend: true, images: true, infra: true, tools: true };
const installed = { win: false, needsInstall: () => false, cdkAccount: "123456789012" };
const names = (plan) => plan.map((suite) => suite.name);
const commands = (suite) => suite.steps.map((step) => step.command);

test("nothing picked, nothing to run", () => {
  assert.deepEqual(suitesFor(none, installed), []);
});

test("every suite, quick ones first and the end-to-end suite last", () => {
  assert.deepEqual(names(suitesFor(all, installed)), ["tools", "infra", "frontend", "backend", "images", "e2e"]);
});

test("the images suite builds both production images for linux/amd64 from the contexts the deploy uses", () => {
  const [images] = suitesFor({ ...none, images: true }, installed);
  assert.deepEqual(images.steps.map((s) => [s.command, s.cwd]), [
    ["docker build --platform linux/amd64 -f backend/Dockerfile -t polygossa-check-backend .", "."],
    ["docker build --platform linux/amd64 -t polygossa-check-frontend frontend", "."],
  ]);
});

test("the images suite needs no npm packages", () => {
  const [images] = suitesFor({ ...none, images: true }, { ...installed, needsInstall: () => true });
  assert.ok(images.steps.every((s) => s.command !== "npm ci"));
});

test("only the picked suites run", () => {
  assert.deepEqual(names(suitesFor({ ...none, infra: true, backend: true }, installed)), ["infra", "backend"]);
});

test("the backend runs the gauntlet's Gradle tasks, through the wrapper for the platform", () => {
  const [linux] = suitesFor({ ...none, backend: true }, installed);
  const tasks = ":backend:compileJava :backend:checkstyleMain :backend:test -Ptest.forks=2";
  assert.deepEqual(commands(linux), [`./gradlew ${tasks}`]);
  const [windows] = suitesFor({ ...none, backend: true }, { ...installed, win: true });
  assert.deepEqual(commands(windows), [`.\\gradlew.bat ${tasks}`]);
  assert.equal(linux.steps[0].cwd, ".");
});

test("the frontend runs unit tests, type check, lint and build in frontend/", () => {
  const [frontend] = suitesFor({ ...none, frontend: true }, installed);
  assert.deepEqual(commands(frontend),
    ["npm test", "npx next typegen && npx tsc --noEmit", "npx eslint .", "npx next build"]);
  assert.ok(frontend.steps.every((step) => step.cwd === "frontend"));
});

test("the end-to-end suite runs npm run e2e in frontend/", () => {
  const [e2e] = suitesFor({ ...none, e2e: true }, installed);
  assert.deepEqual(e2e.steps.map((s) => [s.command, s.cwd]), [["npm run e2e", "frontend"]]);
});

test("infra type-checks, tests and synthesizes with the account and region the deploy uses", () => {
  const [infra] = suitesFor({ ...none, infra: true }, installed);
  assert.deepEqual(commands(infra), ["npm run typecheck", "npm test", "npx cdk synth --quiet"]);
  assert.ok(infra.steps.every((step) => step.cwd === "infra"));
  assert.deepEqual(infra.steps[2].env, { CDK_DEFAULT_ACCOUNT: "123456789012", CDK_DEFAULT_REGION: "eu-west-1" });
});

test("tools run their tests and the complexity lint with the frontend's ESLint", () => {
  const [tools] = suitesFor({ ...none, tools: true }, installed);
  assert.deepEqual(commands(tools), [
    'node --test "tools/**/*.test.mjs"',
    'frontend/node_modules/.bin/eslint --no-config-lookup --rule "{\\"complexity\\":[\\"error\\",10],'
      + '\\"max-lines\\":[\\"error\\",300]}" "tools/**/*.mjs"',
  ]);
  assert.equal(tools.steps[0].cwd, ".");
});

test("on Windows the tools lint names ESLint with backslashes, which cmd.exe needs", () => {
  const [tools] = suitesFor({ ...none, tools: true }, { ...installed, win: true });
  assert.match(tools.steps[1].command, /^frontend\\node_modules\\\.bin\\eslint --no-config-lookup /);
});

test("packages are installed first where missing or out of date, once per folder, and nothing runs without them", () => {
  const plan = suitesFor(all, { ...installed, needsInstall: (dir) => dir === "frontend" || dir === "infra" });
  const installs = plan.flatMap((suite) => suite.steps.filter((s) => s.command === "npm ci")
    .map((s) => `${suite.name}:${s.cwd}:${s.required}`));
  assert.deepEqual(installs, ["tools:frontend:true", "infra:infra:true"]);
  assert.equal(plan[0].steps[0].command, "npm ci");
  assert.equal(plan[1].steps[0].command, "npm ci");
});

test("the frontend's packages are installed by whichever picked suite needs them first", () => {
  const [e2e] = suitesFor({ ...none, e2e: true }, { ...installed, needsInstall: (dir) => dir === "frontend" });
  assert.deepEqual(commands(e2e), ["npm ci", "npm run e2e"]);
  const [frontend] = suitesFor({ ...none, frontend: true, e2e: true },
    { ...installed, needsInstall: (dir) => dir === "frontend" });
  assert.equal(frontend.steps[0].command, "npm ci");
});

test("no install step when the packages are up to date", () => {
  const plan = suitesFor(all, installed);
  assert.ok(plan.every((suite) => suite.steps.every((step) => step.command !== "npm ci")));
  assert.ok(plan.every((suite) => suite.steps.every((step) => !step.required)));
});
