import { expect, test } from "@playwright/test";

const TOKEN = "e2e-curator-token";

test("the curator token gets through the website to the backend", async ({ playwright }) => {
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
