export const ALL = ["backend", "e2e", "frontend", "images", "infra", "tools"];

const RULES = [
  [/^\.github\//, null],
  [/^tools\/ci-checks(\/|\.mjs$)/, null],
  [/^docs\/|\.md$/, []],
  [/^(backend\/Dockerfile|frontend\/Dockerfile$|frontend\/\.dockerignore$)/, ["images"]],
  [/^infra\/lib\/images\.ts$/, ["infra", "tools", "images"]],
  [/^(gradle\/|build\.gradle\.kts$|settings\.gradle\.kts$|gradlew(\.bat)?$|backend\/build\.gradle\.kts$)/,
    ["backend", "e2e", "tools", "images"]],
  [/^(backend\/|config\/checkstyle\/)/, ["backend", "e2e", "tools"]],
  [/^frontend\/(package(-lock)?\.json|next\.config\.ts)$/, ["frontend", "tools", "e2e", "images"]],
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
