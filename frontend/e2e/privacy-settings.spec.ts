import { expect, test, type Browser } from "@playwright/test";

async function newAccount(browser: Browser) {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const email = `privacy-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
  const res = await context.request.post("/api/auth/signup", { data: { email, password: "password123" } });
  expect(res.ok(), await res.text()).toBe(true);
  expect((await context.request.patch("/api/me", { data: { tours: false } })).ok()).toBe(true);
  return { context, email };
}

test("the privacy policy and terms are drafts anyone can read, linked from the landing page", async ({ browser }) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/privacy");
  await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  await expect(page.getByRole("note")).toContainText("Draft");
  await expect(page.getByRole("main")).toContainText("Amazon Web Services, Ireland");
  await page.getByRole("navigation", { name: "Legal" }).getByRole("link", { name: "Terms" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Terms of service" })).toBeVisible();
  expect((await context.cookies()).map((c) => c.name)).not.toContain("lector_token");
  await context.close();
});

test("Download my data saves a file with the account's texts and words", async ({ browser }) => {
  const { context, email } = await newAccount(browser);
  await context.request.post("/api/texts", { data: { title: "Mi texto", language: "es", content: "Hola mundo." } });
  await context.request.post("/api/vocabulary", { data: { language: "es", term: "mundo" } });
  const page = await context.newPage();
  await page.goto("/settings/privacy");

  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download my data" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/-data\.json$/);
  const data = JSON.parse(await (await import("node:fs/promises")).readFile((await file.path())!, "utf8"));
  expect(data.account.email).toBe(email);
  expect(JSON.stringify(data.texts)).toContain("Hola mundo.");
  expect(JSON.stringify(data.vocabulary_entries)).toContain("mundo");
  await context.close();
});

test("Delete my account needs the account's email typed, then signs out with everything gone", async ({ browser }) => {
  const { context, email } = await newAccount(browser);
  const page = await context.newPage();
  await page.goto("/settings/privacy");
  const group = page.getByRole("group", { name: "Delete my account" });
  await expect(group).toContainText("can't be undone");
  const confirm = group.getByLabel("Type your email to confirm");
  const button = group.getByRole("button", { name: "Delete my account" });

  await expect(button).toBeDisabled();
  await confirm.fill("someone-else@test.co");
  await expect(button).toBeDisabled();
  await confirm.fill(email.toUpperCase());
  const session = (await context.cookies()).find((c) => c.name === "lector_token")!.value;
  await button.click();

  await expect(page).toHaveURL((url) => url.pathname === "/");
  expect((await context.cookies()).find((c) => c.name === "lector_token")?.value).not.toBe(session);
  await page.goto("/library");
  const now = await context.request.get("/api/me");
  expect(now.ok() ? (await now.json()).email : null).not.toBe(email);
  const stranger = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const old = await stranger.request.get("/api/me", { headers: { cookie: `lector_token=${session}` } });
  expect(old.status()).toBe(401);
  await stranger.close();
  const login = await context.request.post("/api/auth/login", { data: { email, password: "password123" } });
  expect(login.status()).toBe(401);
  await context.close();
});
