import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

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
const gradlew = process.platform === "win32" ? `"${path.join(repo, "gradlew.bat")}"` : "./gradlew";
const backend = {
  PORT: backendPort,
  OPENAI_API_KEY: "",
  STORAGE_DIR: "./data/e2e-uploads",
  CURATOR_TOKEN: "e2e-curator-token",
  LOGGING_FILE_NAME: path.join(__dirname, "e2e-logs", "backend.log"),
};

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL, trace: process.env.CI ? "retain-on-failure" : "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.CI ? { channel: "chrome" } : {}) } }],
  webServer: external
    ? []
    : [
        {
          command: `${gradlew} :backend:bootTestRun`,
          cwd: repo,
          env: { ...process.env, ...backend },
          url: `http://localhost:${backendPort}/api/health`,
          reuseExistingServer: true,
          timeout: 180_000,
        },
        {
          command: "node scripts/e2e-server.mjs",
          env: { ...process.env, E2E_PORT: port, BACKEND_URL: `http://localhost:${backendPort}` },
          url: `${baseURL}/icon.svg`,
          reuseExistingServer: false,
          timeout: 240_000,
        },
      ],
});
