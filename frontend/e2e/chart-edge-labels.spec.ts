import { expect, test, type Page } from "@playwright/test";

let savedWord: number | null = null;

test.beforeEach(async ({ page }) => {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const res = await page.request.post("/api/vocabulary", { data: { language: me.targetLanguage ?? "es", term: `bordes${Date.now()}`, status: "known" } });
  expect(res.ok(), await res.text()).toBe(true);
  savedWord = (await res.json()).id;
});

test.afterEach(async ({ page }) => {
  if (savedWord !== null) await page.request.delete(`/api/vocabulary/${savedWord}`);
  savedWord = null;
});

async function dateLabelsOutside(page: Page) {
  const chart = page.locator("figure").filter({ has: page.getByRole("heading", { name: /words — last week$/ }) }).locator("svg").first();
  await chart.scrollIntoViewIfNeeded();
  return chart.evaluate((svg) => {
    const box = svg.getBoundingClientRect();
    return [...svg.querySelectorAll("text")]
      .filter((t) => /[A-Za-z]/.test(t.textContent ?? ""))
      .map((t) => ({ text: t.textContent, r: t.getBoundingClientRect() }))
      .filter(({ r }) => r.left < box.left - 0.5 || r.right > box.right + 0.5)
      .map(({ text }) => text);
  });
}

for (const width of [1400, 390]) {
  test(`every date under the weekly chart lies inside it at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /words — last week$/ })).toBeVisible();
    expect(await dateLabelsOutside(page)).toEqual([]);
  });
}

test("the last label is the last day's date in full", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  await page.goto("/dashboard");
  const figure = page.locator("figure").filter({ has: page.getByRole("heading", { name: /words — last week$/ }) });
  const lastLabel = await figure.locator("svg").first().locator("text").filter({ hasText: /[A-Za-z]/ }).last().textContent();
  await figure.getByRole("button", { name: "Table" }).click();
  await expect(figure.locator("tbody tr").last().locator("td").first()).toHaveText(lastLabel!);
  expect(lastLabel).toMatch(/^[A-Za-z]+ \d{1,2}$/);
});
