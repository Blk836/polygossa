import { expect, test, type Browser } from "@playwright/test";

// cognito-login.feature, "Signing out everywhere": from Settings › Profile, every device's session ends. Uses an
// account of its own (signed in on two "devices"), never the shared test account other specs run as.

async function device(browser: Browser, email: string, path: "signup" | "login") {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
  const res = await context.request.post(`/api/auth/${path}`, { data: { email, password: "password123" } });
  expect(res.ok(), await res.text()).toBe(true);
  return context;
}

test("signing out everywhere ends this device's and every other device's session", async ({ browser }) => {
  const email = `everywhere-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
  const laptop = await device(browser, email, "signup");
  expect((await laptop.request.patch("/api/me", { data: { tours: false } })).ok()).toBe(true);
  const phone = await device(browser, email, "login");
  expect((await phone.request.get("/api/me")).status()).toBe(200);

  const page = await laptop.newPage();
  await page.goto("/settings");
  const group = page.getByRole("group", { name: "Signed-in devices" });
  await expect(group).toContainText("every device");
  await group.getByRole("button", { name: "Sign out everywhere" }).click();

  await expect(page).toHaveURL((url) => url.pathname === "/");
  expect((await phone.request.get("/api/me")).status()).toBe(401);
  // The laptop is no longer signed in to this account. (The landing page prefetches /library, and in the browser
  // tests that can auto-sign it in as the shared test account, which production never does.)
  const laptopMe = await laptop.request.get("/api/me");
  if (laptopMe.status() !== 401) expect(((await laptopMe.json()) as { email: string }).email).not.toBe(email);
  await laptop.close();
  await phone.close();
});
