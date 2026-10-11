import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-live",
  workers: 1,
  timeout: 90_000,
  reporter: "list",
  use: { baseURL: process.env.LIVE_BASE_URL || "http://localhost:3000", trace: "off" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
