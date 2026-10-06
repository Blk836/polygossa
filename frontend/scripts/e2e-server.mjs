// The server the e2e suite runs against: a production build (`next build` + `next start`) on its own port
// (E2E_PORT, default 3210), next to any `next dev` on :3000 (Next 16 builds into a separate folder from dev).
// Production pages are rendered once instead of compiled per request, and serve many test workers without the dev
// server's on-demand compiling, which made the suite about twice as slow. The build is skipped when nothing it
// depends on changed since the last one.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = process.env.E2E_PORT ?? "3210";
const next = path.join(root, "node_modules", "next", "dist", "bin", "next");

/** What the build reads: app code, styles, public files and config. Unit tests and e2e specs aren't in it. */
const INPUTS = ["app", "components", "lib", "public", "proxy.ts", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "package.json", "package-lock.json"];
const isTest = (file) => /\.test\.tsx?$/.test(file);

function newest(entry) {
  const full = path.join(root, entry);
  if (!fs.existsSync(full)) return 0;
  const stat = fs.statSync(full);
  if (!stat.isDirectory()) return isTest(entry) ? 0 : stat.mtimeMs;
  return fs.readdirSync(full).reduce((max, name) => Math.max(max, newest(path.join(entry, name))), 0);
}

/** True when there is no build, or a build input is newer than it (or the brand name it inlined changed). */
export function stale() {
  const buildId = path.join(root, ".next", "BUILD_ID");
  const stamp = path.join(root, ".next", "e2e-build-env");
  const env = `BRAND_NAME=${process.env.BRAND_NAME ?? ""}`;
  if (!fs.existsSync(buildId) || !fs.existsSync(stamp) || fs.readFileSync(stamp, "utf8") !== env) return true;
  const built = fs.statSync(buildId).mtimeMs;
  return INPUTS.some((entry) => newest(entry) > built);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (stale()) {
    console.log("[e2e-server] building the frontend (sources changed since the last build)…");
    const build = spawnSync(process.execPath, [next, "build"], { cwd: root, stdio: "inherit" });
    if (build.status !== 0) process.exit(build.status ?? 1);
    fs.writeFileSync(path.join(root, ".next", "e2e-build-env"), `BRAND_NAME=${process.env.BRAND_NAME ?? ""}`);
  } else {
    console.log("[e2e-server] frontend build is up to date");
  }
  const server = spawn(process.execPath, [next, "start", "-p", port], { cwd: root, stdio: "inherit" });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
  server.on("exit", (code) => process.exit(code ?? 0));
}
