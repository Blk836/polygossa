import { expect, test, type APIRequestContext } from "@playwright/test";

const SRT = ["hola a todos", "hoy vamos a la playa", "nos vemos pronto"]
  .map((line, k) => `${k + 1}\n00:00:0${k * 3},000 --> 00:00:0${k * 3 + 2},000\n${line}\n`)
  .join("\n");

async function owner(request: APIRequestContext, email: string) {
  const signup = await request.post("/api/auth/signup", { data: { email, password: "password123", displayName: "Episode owner" } });
  expect(signup.ok(), await signup.text()).toBe(true);
  const video = await request.post("/api/texts/import-youtube", {
    multipart: {
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      language: "es",
      title: "Tidy me episode",
      file: { name: "transcript.srt", mimeType: "text/plain", buffer: Buffer.from(SRT) },
    },
  });
  expect(video.ok(), await video.text()).toBe(true);
  const text = await request.post("/api/texts", {
    data: { title: "Plain text lesson", language: "es", content: "hola a todos", isPublic: false, category: "other" },
  });
  expect(text.ok(), await text.text()).toBe(true);
  return { videoId: (await video.json()).id as number, textId: (await text.json()).id as number };
}

test("an admin tidies one video episode from a user's list and sees what changed", async ({ page, playwright }) => {
  const baseURL = test.info().project.use.baseURL;
  const email = `tidy-e2e-${Date.now()}@test.co`;
  const other = await playwright.request.newContext({ baseURL });
  const { videoId, textId } = await owner(other, email);
  try {
    await page.goto("/admin?tab=users");
    await page.getByPlaceholder("Search by email or name").fill(email);
    await page.getByPlaceholder("Search by email or name").press("Enter");
    await page.getByRole("row").filter({ hasText: email }).getByRole("button", { name: "Open" }).click();
    const panel = page.getByRole("region", { name: `User ${email}` });

    const videoRow = panel.getByRole("listitem").filter({ hasText: "Tidy me episode" });
    const textRow = panel.getByRole("listitem").filter({ hasText: "Plain text lesson" });
    await expect(videoRow.getByRole("button", { name: "Remove" })).toBeVisible();
    await expect(textRow.getByRole("button", { name: "Remove" })).toBeVisible();
    await expect(textRow.getByRole("button", { name: "Tidy transcript" })).toHaveCount(0);

    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route(`**/api/admin/texts/${videoId}/tidy-transcript`, async (route) => {
      await held;
      await route.continue();
    });
    await videoRow.getByRole("button", { name: "Tidy transcript" }).click();
    await expect(videoRow.getByRole("button", { name: "Tidying…" })).toBeDisabled();
    release();
    await expect(panel.getByRole("status")).toHaveText("Tidied 0 of 3 lines in “Tidy me episode”");
    await expect(videoRow.getByRole("button", { name: "Tidy transcript" })).toBeEnabled();

    await page.getByRole("navigation", { name: "Admin pages" }).getByRole("link", { name: "Log" }).click();
    await expect(page.getByRole("region", { name: "Recent actions" }))
      .toContainText(`tidy transcript ${email} (Tidy me episode: 0 of 3 lines)`);
  } finally {
    await other.delete(`/api/texts/${videoId}`);
    await other.delete(`/api/texts/${textId}`);
    await other.dispose();
  }
});

test("an episode that can't be tidied shows the server's error and can be tried again", async ({ page, playwright }) => {
  const baseURL = test.info().project.use.baseURL;
  const email = `tidy-gone-e2e-${Date.now()}@test.co`;
  const other = await playwright.request.newContext({ baseURL });
  const { videoId, textId } = await owner(other, email);
  try {
    await page.goto("/admin?tab=users");
    await page.getByPlaceholder("Search by email or name").fill(email);
    await page.getByPlaceholder("Search by email or name").press("Enter");
    await page.getByRole("row").filter({ hasText: email }).getByRole("button", { name: "Open" }).click();
    const panel = page.getByRole("region", { name: `User ${email}` });
    const videoRow = panel.getByRole("listitem").filter({ hasText: "Tidy me episode" });
    await expect(videoRow.getByRole("button", { name: "Tidy transcript" })).toBeVisible();

    await page.route(`**/api/admin/texts/${videoId}/tidy-transcript`, (route) =>
      route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "bad_request", message: "This text has no video captions to tidy" }) }));
    await videoRow.getByRole("button", { name: "Tidy transcript" }).click();
    await expect(panel.getByText("This text has no video captions to tidy")).toBeVisible();
    await expect(videoRow.getByRole("button", { name: "Tidy transcript" })).toBeEnabled();
  } finally {
    await other.delete(`/api/texts/${videoId}`);
    await other.delete(`/api/texts/${textId}`);
    await other.dispose();
  }
});
