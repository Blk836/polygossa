import { expect, test } from "@playwright/test";

// Scenario (docs/acceptance/copy-videos.feature): production accepts the curator token through the website. Its
// backend has no public address, so the import tool reaches /api/curator/* through the website, which must pass the
// X-Curator-Token header on. The e2e backend runs with CURATOR_TOKEN=e2e-curator-token (playwright.config.ts).

const TOKEN = "e2e-curator-token";

test("the curator token gets through the website to the backend", async ({ playwright }) => {
  // A fresh request context: no session cookie, as for the command-line tool.
  const tool = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  const options = await tool.get("/api/curator/options", { headers: { "X-Curator-Token": TOKEN } });
  expect(options.status()).toBe(200);
  expect((await options.json()).languages).toContain("fr");

  const missing = await tool.get("/api/curator/videos/AAAAAAAAAAA/copy?language=fr", {
    headers: { "X-Curator-Token": TOKEN },
  });
  expect(missing.status()).toBe(404);
  expect((await missing.json()).code).toBe("not_on_source");
  await tool.dispose();
});

test("without the token, or with a wrong one, curator calls are refused", async ({ playwright }) => {
  const tool = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
  expect((await tool.get("/api/curator/options")).status()).toBe(401);
  expect((await tool.get("/api/curator/options", { headers: { "X-Curator-Token": "wrong" } })).status()).toBe(401);
  await tool.dispose();
});
