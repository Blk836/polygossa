export const ALL = ["backend", "e2e", "frontend", "infra", "tools"];

const RULES = [
  [/^\.github\//, null],
  [/^tools\/ci-checks(\/|\.mjs$)/, null],
  [/^docs\/|\.md$/, []],
  [/^(backend\/|gradle\/|config\/checkstyle\/|build\.gradle\.kts$|settings\.gradle\.kts$|gradlew(\.bat)?$)/,
    ["backend", "e2e", "tools"]],
  [/^frontend\//, ["frontend", "tools", "e2e"]],
  [/^infra\//, ["infra", "tools"]],
  [/^tools\//, ["tools"]],
];

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

export function outputLines(checks) {
  return ALL.map((check) => `${check}=${checks[check]}`);
}
