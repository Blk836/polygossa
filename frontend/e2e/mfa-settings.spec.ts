import { expect, test, type Page } from "@playwright/test";

const section = (page: Page) => page.getByRole("group", { name: "Two-step sign-in" });

test("accounts that don't sign in through Cognito see no two-step section", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByRole("group", { name: "Signed-in devices" })).toBeVisible();
  await expect(section(page)).toHaveCount(0);
});

test("a Cognito account sets up an authenticator app with its key and a code, and can turn it off", async ({ page }) => {
  let on = false;
  const confirmed: unknown[] = [];
  await page.route("**/api/auth/mfa", async (route) => {
    const req = route.request();
    if (req.method() === "GET") return route.fulfill({ json: { on, federated: false } });
    if (req.method() === "DELETE") { on = false; return route.fulfill({ json: { on, federated: false } }); }
    const body = req.postDataJSON() as { action: string; code?: string };
    if (body.action === "start") {
      return route.fulfill({ json: { secret: "ABCDEFGHIJKLMNOP", uri: "otpauth://totp/x?secret=ABCDEFGHIJKLMNOP" } });
    }
    confirmed.push(body.code);
    if (body.code !== "123456") return route.fulfill({ status: 400, json: { message: "That code didn't match." } });
    on = true;
    return route.fulfill({ json: { on, federated: false } });
  });

  await page.goto("/settings");
  await expect(section(page)).toContainText("authenticator app");
  await section(page).getByRole("button", { name: "Set up an authenticator app" }).click();
  await expect(page.getByTestId("mfa-secret")).toHaveText("ABCD EFGH IJKL MNOP");

  const codeBox = section(page).getByLabel("Code from the app");
  await codeBox.fill("12a34");
  await expect(codeBox).toHaveValue("1234");
  await expect(section(page).getByRole("button", { name: "Turn on" })).toBeDisabled();
  await codeBox.fill("000000");
  await section(page).getByRole("button", { name: "Turn on" }).click();
  await expect(section(page)).toContainText("That code didn't match.");

  await codeBox.fill("123456");
  await section(page).getByRole("button", { name: "Turn on" }).click();
  await expect(section(page)).toContainText("On: signing in asks for a code");
  expect(confirmed).toEqual(["000000", "123456"]);

  await section(page).getByRole("button", { name: "Turn off" }).click();
  await expect(section(page).getByRole("button", { name: "Set up an authenticator app" })).toBeVisible();
});

test("a Google account is pointed to Google's own two-step verification", async ({ page }) => {
  await page.route("**/api/auth/mfa", (route) => route.fulfill({ json: { on: false, federated: true } }));
  await page.goto("/settings");
  await expect(section(page)).toContainText("turn on two-step verification in your Google account");
  await expect(section(page).getByRole("button")).toHaveCount(0);
});
