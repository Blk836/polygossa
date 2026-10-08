import { expect, test } from "@playwright/test";

// Login with Cognito (cognito-login.feature): the browser tests have no user pool, so they check what holds without
// one: a forged or stray sign-in return never creates a session, and the forms and auto-login still work. The
// Cognito half of the flow is unit-tested in lib/cognito.test.ts and was checked by hand against the QA pool.
test.describe("sign-in return", () => {
  for (const query of ["", "?code=abc", "?code=abc&state=forged", "?error=access_denied"]) {
    test(`a return without a pending sign-in (${query || "nothing"}) creates no session`, async ({ request }) => {
      const res = await request.get(`/api/auth/callback${query}`, { maxRedirects: 0 });
      expect(res.status()).toBe(307);
      expect(new URL(res.headers().location, "http://x").pathname + new URL(res.headers().location, "http://x").search)
        .toBe("/login?error=failed");
      expect(res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie" && /lector_token=[^;]/.test(h.value)))
        .toEqual([]);
    });
  }

  test("starting a Cognito sign-in without a pool goes to the sign-in form", async ({ page }) => {
    await page.goto("/api/auth/cognito/start?screen=login");
    expect(new URL(page.url()).pathname).toBe("/login");
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
