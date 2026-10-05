import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for layout and other things Vitest's node environment can't see.
 * They need the backend (login is auto-bypassed in dev); both servers are reused if already running
 * (e.g. via start.bat), otherwise started here — the backend needs JAVA_HOME set to a JDK 21+.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://localhost:3000" },
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
    { command: "npm run dev", url: "http://localhost:3000/favicon.ico", reuseExistingServer: true, timeout: 120_000 },
  ],
});
