import { expect, test } from "@playwright/test";

const REFUSED = {
  code: "not_shareable",
  message: "This can't be shared in the community library: Graphic violence. Import it without sharing to read it yourself.",
};

test("the import form shows why sharing was refused and keeps what was typed", async ({ page }) => {
  await page.route("**/api/texts", (route) =>
    route.request().method() === "POST" ? route.fulfill({ status: 422, json: REFUSED }) : route.continue());
  await page.goto("/import");
  await page.getByRole("textbox", { name: "Title" }).fill("Refused");
  await page.getByRole("textbox", { name: /Text/ }).fill("Some text.");
  await page.getByRole("checkbox", { name: /Share in the community library/ }).check();
  await page.getByRole("button", { name: "Import and start reading" }).click();
  await expect(page.getByText(REFUSED.message)).toBeVisible();
  await expect(page).toHaveURL(/\/import/);
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Refused");
  await expect(page.getByRole("checkbox", { name: /Share in the community library/ })).toBeChecked();
});

test("a library card shows why sharing was refused and stays private", async ({ page }) => {
  await page.goto("/library");
  const language = (await (await page.request.get("/api/me")).json()).targetLanguage ?? "es";
  const title = `Refused ${Math.floor(Math.random() * 1e9).toString(36)}`;
  const res = await page.request.post("/api/texts", { data: { title, language, content: "Hola.", isPublic: false, category: "news" } });
  const id = (await res.json()).id as number;
  try {
    await page.route(`**/api/texts/${id}`, (route) =>
      route.request().method() === "PATCH" ? route.fulfill({ status: 422, json: REFUSED }) : route.continue());
    await page.reload();
    const card = page.getByTestId("card-grid").getByRole("article").filter({ hasText: title });
    await card.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByText(REFUSED.message)).toBeVisible();
    await expect(card.getByRole("button", { name: "Share", exact: true })).toBeVisible();
    expect((await (await page.request.get(`/api/texts/${id}`)).json()).text.isPublic).toBe(false);
  } finally {
    await page.request.delete(`/api/texts/${id}`);
  }
});
