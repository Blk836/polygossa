import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";

const WINDOWS_AWS = "C:\\Program Files\\Amazon\\AWSCLIV2\\aws.exe";
const AWS_CLI = process.env.AWS_CLI ?? (process.platform === "win32" && existsSync(WINDOWS_AWS) ? WINDOWS_AWS : "aws");

function aws(...args: string[]): string {
  return execFileSync(AWS_CLI, [...args, "--profile", "polygossa", "--region", "eu-west-1", "--output", "text"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function qaPoolId(): string {
  let issuer: string;
  try {
    issuer = aws("cloudformation", "describe-stacks", "--stack-name", "PolygossaQa",
      "--query", "Stacks[0].Outputs[?OutputKey=='CognitoIssuer'].OutputValue");
  } catch (error) {
    throw new Error(`AWS isn't signed in (run: aws login --profile polygossa): ${String(error).split("\n")[0]}`);
  }
  return issuer.split("/").pop()!;
}

function userExists(pool: string, email: string): boolean {
  try {
    aws("cognito-idp", "admin-get-user", "--user-pool-id", pool, "--username", email);
    return true;
  } catch (error) {
    if (String((error as { stderr?: string }).stderr ?? error).includes("UserNotFoundException")) return false;
    throw error;
  }
}

function removeUser(pool: string, email: string): boolean {
  try {
    aws("cognito-idp", "admin-delete-user", "--user-pool-id", pool, "--username", email);
    return true;
  } catch {
    return false;
  }
}

test("a new learner signs in through the QA user pool, and deleting the account removes them from it", async ({ page, baseURL }) => {
  const app = await page.request.get("/login").catch(() => null);
  expect(app?.ok(), `the local app isn't answering at ${baseURL}: start it (IntelliJ's App run configuration)`).toBe(true);

  const pool = qaPoolId();
  const email = `live-check-${Date.now()}@example.com`;
  const password = `${randomBytes(12).toString("base64url")}Aa1!`;
  aws("cognito-idp", "admin-create-user", "--user-pool-id", pool, "--username", email, "--message-action", "SUPPRESS",
    "--user-attributes", `Name=email,Value=${email}`, "Name=email_verified,Value=true");
  try {
    aws("cognito-idp", "admin-set-user-password", "--user-pool-id", pool, "--username", email, "--password", password,
      "--permanent");

    await page.goto("/login");
    await page.getByRole("link", { name: "Sign in", exact: true }).click();
    await page.waitForURL(/\.amazoncognito\.com\//);
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await page.waitForURL((url) => url.origin === new URL(baseURL!).origin && !url.pathname.startsWith("/login"));

    const me = await page.request.get("/api/me");
    expect(me.ok()).toBe(true);
    expect((await me.json()).email).toBe(email);

    const deleted = await page.request.post("/api/auth/delete-account", { data: { confirmEmail: email } });
    expect(deleted.ok(), await deleted.text()).toBe(true);
    expect(userExists(pool, email)).toBe(false);
  } finally {
    removeUser(pool, email);
  }
});
