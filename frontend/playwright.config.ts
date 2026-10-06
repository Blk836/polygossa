import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests for layout and other things Vitest's node environment can't see.
 * They run against a production build of the frontend on its own port (scripts/e2e-server.mjs: built only when
 * sources changed, then `next start` on E2E_PORT, default 3210), so a `next dev` on :3000 can keep running. It talks
 * to a backend of its own on E2E_BACKEND_PORT (default 8210), started here (JAVA_HOME set to a JDK 21+) and reused if
 * one is left over: no OpenAI key, so tests never call OpenAI (and sharing skips the AI review), and its own database
 * and uploads under backend/data/e2e*, so the IntelliJ run on :8080 and its data are untouched. Login is
 * auto-bypassed in dev. E2E_BASE_URL points the tests at another frontend instead (e.g. http://localhost:3000 to debug
 * against the dev server and its backend).
 */
// Playwright stops the servers it started with `taskkill /T` on Windows. Git Bash can leave System32 off PATH, and
// then the run hangs after the last test, waiting for a server that was never stopped.
if (process.platform === "win32" && process.env.SystemRoot) {
  const system32 = `${process.env.SystemRoot}\\System32`;
  const path = process.env.PATH ?? "";
  if (!path.toLowerCase().split(";").includes(system32.toLowerCase())) process.env.PATH = `${path};${system32}`;
}

const external = process.env.E2E_BASE_URL || undefined;
const port = process.env.E2E_PORT || "3210";
const baseURL = external ?? `http://localhost:${port}`;
const backendPort = process.env.E2E_BACKEND_PORT || "8210";
const repo = path.join(__dirname, "..");
// By full path: a shell with NoDefaultCurrentDirectoryInExePath set won't run gradlew.bat from the current folder.
const gradlew = process.platform === "win32" ? `"${path.join(repo, "gradlew.bat")}"` : "./gradlew";
const backend = {
  PORT: backendPort,
  OPENAI_API_KEY: "",
  DATABASE_URL: "jdbc:h2:file:./data/e2e;MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DEFAULT_NULL_ORDERING=HIGH",
  STORAGE_DIR: "./data/e2e-uploads",
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: external
    ? []
    : [
        {
          command: `${gradlew} :backend:bootRun`,
          cwd: repo,
          env: { ...process.env, ...backend },
          url: `http://localhost:${backendPort}/api/health`,
          reuseExistingServer: true,
          timeout: 180_000,
        },
        // favicon.ico skips proxy.ts; a page URL would loop on the auto-login redirect for a cookie-less check.
        {
          command: "node scripts/e2e-server.mjs",
          env: { ...process.env, E2E_PORT: port, BACKEND_URL: `http://localhost:${backendPort}` },
          url: `${baseURL}/favicon.ico`,
          reuseExistingServer: false,
          timeout: 240_000,
        },
      ],
});
