// Which CI checks a pull request needs, from the files it changes (docs/acceptance/ci.feature). When unsure, every
// check runs: a change to CI itself, a file outside the known parts, or an unknown list of files.

/** The checks, as the CI workflow's jobs and steps name them. */
export const ALL = ["backend", "e2e", "frontend", "infra", "tools"];

/** First match wins; null means every check. */
const RULES = [
  [/^\.github\//, null],
  [/^tools\/ci-checks(\/|\.mjs$)/, null],
  [/^docs\/|\.md$/, []],
  [/^(backend\/|gradle\/|config\/checkstyle\/|build\.gradle\.kts$|settings\.gradle\.kts$|gradlew(\.bat)?$)/,
    ["backend", "e2e"]],
  // The tools checks lint with ESLint from frontend/'s packages.
  [/^frontend\//, ["frontend", "tools", "e2e"]],
  [/^infra\//, ["infra"]],
  [/^tools\//, ["tools"]],
];

/**
 * @param {string[] | null} files changed paths relative to the repository root, or null when they couldn't be read
 * @returns {Record<string, boolean>} for each check in ALL, whether it runs
 */
export function checksFor(files) {
  const needed = new Set(files === null ? ALL : []);
  for (const raw of files ?? []) {
    const file = raw.trim().replaceAll("\\", "/");
    if (!file) continue;
    const rule = RULES.find(([pattern]) => pattern.test(file));
    for (const check of rule ? rule[1] ?? ALL : ALL) needed.add(check);
  }
  return Object.fromEntries(ALL.map((check) => [check, needed.has(check)]));
}

/** `name=true|false` lines for $GITHUB_OUTPUT. */
export function outputLines(checks) {
  return ALL.map((check) => `${check}=${checks[check]}`);
}
