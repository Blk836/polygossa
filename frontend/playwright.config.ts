import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for layout and other things Vitest's node environment can't see.
 * They run against a production build of the frontend on its own port (scripts/e2e-server.mjs: built only when
 * sources changed, then `next start` on E2E_PORT, default 3210), so a `next dev` on :3000 can keep running. The
 * backend on :8080 is reused if already running (e.g. the IntelliJ App run config), otherwise started here — it needs
 * JAVA_HOME set to a JDK 21+. Login is auto-bypassed in dev. E2E_BASE_URL points the tests at another frontend
 * instead (e.g. http://localhost:3000 to debug against the dev server).
 */
// Playwright stops the servers it started with `taskkill /T` on Windows. Git Bash can leave System32 off PATH, and
// then the run hangs after the last test, waiting for a server that was never stopped.
if (process.platform === "win32" && process.env.SystemRoot) {
  const system32 = `${process.env.SystemRoot}\\System32`;
  const path = process.env.PATH ?? "";
  if (!path.toLowerCase().split(";").includes(system32.toLowerCase())) process.env.PATH = `${path};${system32}`;
}

const external = process.env.E2E_BASE_URL;
const port = process.env.E2E_PORT ?? "3210";
const baseURL = external ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: process.platform === "win32" ? "gradlew.bat :backend:bootRun" : "./gradlew :backend:bootRun",
      cwd: "..",
      url: "http://localhost:8080/api/health",
      reuseExistingServer: true,
      timeout: 180_000,
    },
    // favicon.ico skips proxy.ts; a page URL would loop on the auto-login redirect for a cookie-less check.
    ...(external
      ? []
      : [{ command: "node scripts/e2e-server.mjs", env: { E2E_PORT: port }, url: `${baseURL}/favicon.ico`, reuseExistingServer: false, timeout: 240_000 }]),
  ],
});
