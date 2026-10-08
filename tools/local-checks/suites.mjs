// The suites a local run executes, with the gauntlet's commands (CLAUDE.md) and the same steps as CI's jobs
// (.github/workflows/ci.yml), so a local result and a CI result mean the same thing. Commands are shell strings that
// work in both cmd.exe and sh.

const ORDER = ["tools", "infra", "frontend", "backend", "e2e"];

/** The folder each suite's packages live in (tools lint with the frontend's ESLint), or none. */
const PACKAGES = { tools: "frontend", infra: "infra", frontend: "frontend", e2e: "frontend" };

const TOOLS_LINT = 'frontend/node_modules/.bin/eslint --no-config-lookup --rule '
  + '"{\\"complexity\\":[\\"error\\",10],\\"max-lines\\":[\\"error\\",300]}" "tools/**/*.mjs"';

function stepsOf(name, { win, cdkAccount }) {
  switch (name) {
    case "tools":
      return [{ command: 'node --test "tools/**/*.test.mjs"', cwd: "." }, { command: TOOLS_LINT, cwd: "." }];
    case "infra":
      return [
        { command: "npm run typecheck", cwd: "infra" },
        { command: "npm test", cwd: "infra" },
        { command: "npx cdk synth --quiet", cwd: "infra",
          env: { CDK_DEFAULT_ACCOUNT: cdkAccount, CDK_DEFAULT_REGION: "eu-west-1" } },
      ];
    case "frontend":
      return ["npm test", "npx next typegen && npx tsc --noEmit", "npx eslint .", "npx next build"]
        .map((command) => ({ command, cwd: "frontend" }));
    case "backend":
      return [{ command: `${win ? "gradlew.bat" : "./gradlew"} :backend:compileJava :backend:checkstyleMain :backend:test`,
        cwd: "." }];
    default:
      return [{ command: "npm run e2e", cwd: "frontend" }];
  }
}

/**
 * @param {Record<string, boolean>} checks which checks to run (tools/ci-checks)
 * @param {{win: boolean, needsInstall(dir: string): boolean, cdkAccount?: string}} env
 * @returns {{name: string, steps: {command: string, cwd: string, env?: object, required?: boolean}[]}[]}
 */
export function suitesFor(checks, env) {
  const installed = new Set();
  return ORDER.filter((name) => checks[name]).map((name) => {
    const steps = stepsOf(name, env);
    const dir = PACKAGES[name];
    if (dir && !installed.has(dir) && env.needsInstall(dir)) {
      steps.unshift({ command: "npm ci", cwd: dir, required: true });
    }
    if (dir) installed.add(dir);
    return { name, steps };
  });
}
