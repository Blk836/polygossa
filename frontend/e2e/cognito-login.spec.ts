import { expect, test } from "@playwright/test";

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
