import { expect, test } from "@playwright/test";

const LINE = "Bonjour à tous, aujourd'hui on parle du marché de la ville. ";

test("the video form's transcript box takes a transcript longer than a text", async ({ page }) => {
  const transcript = LINE.repeat(Math.ceil(150_000 / LINE.length)).slice(0, 150_000);
  let sent: string | null = null;
  await page.route("**/api/texts/import-youtube", async (route) => {
    sent = route.request().postDataBuffer()?.toString("utf8") ?? "";
    await route.fulfill({ status: 201, json: { id: 0 } });
  });
  await page.goto("/import");
  await page.getByRole("button", { name: "YouTube video", exact: true }).click();
  await page.getByRole("textbox", { name: "YouTube link" }).fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await page.getByText("No captions in this language? Add your own transcript").click();
  const box = page.getByRole("textbox", { name: "Or paste the transcript" });
  await box.fill(transcript);
  await expect.poll(() => box.evaluate((el: HTMLTextAreaElement) => el.value.length)).toBe(150_000);
  await page.getByRole("button", { name: /Import/ }).last().click();
  await expect.poll(() => sent).not.toBeNull();
  expect(sent!).toContain(transcript.trimEnd());
});
