// The suites a local run executes, with the gauntlet's commands (CLAUDE.md) and the same steps as CI's jobs
// (.github/workflows/ci.yml), so a local result and a CI result mean the same thing. Commands are shell strings that
// work in both cmd.exe and sh.

const ORDER = ["tools", "infra", "frontend", "backend", "e2e"];

/** The folder each suite's packages live in (tools lint with the frontend's ESLint), or none. */
const PACKAGES = { tools: "frontend", infra: "infra", frontend: "frontend", e2e: "frontend" };

const TOOLS_LINT = ' --no-config-lookup --rule '
  + '"{\\"complexity\\":[\\"error\\",10],\\"max-lines\\":[\\"error\\",300]}" "tools/**/*.mjs"';

// Programs in the repository are named by path, with backslashes on Windows: cmd.exe may be told not to look in the
// current folder (NoDefaultCurrentDirectoryInExePath, which Claude Code sets) and doesn't take forward slashes.
const program = (path, win) => (win ? path.replaceAll("/", "\\") : path);

function stepsOf(name, { win, cdkAccount }) {
  switch (name) {
    case "tools":
      return [{ command: 'node --test "tools/**/*.test.mjs"', cwd: "." },
        { command: program("frontend/node_modules/.bin/eslint", win) + TOOLS_LINT, cwd: "." }];
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
    // 2 test JVMs instead of CI's 4: on the PC they share memory with IntelliJ, the dev servers and other sessions,
    // and 4 ran it out.
    case "backend":
      return [{ cwd: ".", command: `${program(win ? "./gradlew.bat" : "./gradlew", win)}`
        + " :backend:compileJava :backend:checkstyleMain :backend:test -Ptest.forks=2" }];
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
