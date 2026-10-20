import { expect, test, type Page } from "@playwright/test";

async function headerAt(page: Page, width: number) {
  await page.setViewportSize({ width, height: 800 });
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("link", { name: "Start free" })).toBeVisible();
  const height = async (name: string) => (await header.getByRole("link", { name, exact: true }).boundingBox())!.height;
  return {
    header: (await header.boundingBox())!.height,
    logo: await height("Home"),
    signIn: await height("Sign in"),
    start: await height("Start free"),
    overflow: await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
  };
}

test("the landing header is one row on small phones, as tall as at 390 px", async ({ page }) => {
  const reference = await headerAt(page, 390);
  for (const width of [360, 375]) {
    const at = await headerAt(page, width);
    expect(at.logo, `logo at ${width}`).toBeLessThanOrEqual(36);
    expect(at.signIn, `Sign in at ${width}`).toBeLessThanOrEqual(reference.signIn);
    expect(at.start, `Start free at ${width}`).toBeLessThanOrEqual(reference.start);
    expect(at.header, `header at ${width}`).toBeLessThanOrEqual(reference.header);
    expect(at.overflow, `overflow at ${width}`).toBe(0);
  }
});

test("on a laptop the header keeps its section links on one row", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const header = page.getByRole("banner");
  await expect(header.getByRole("navigation", { name: "Sections" })).toBeVisible();
  const top = async (name: string) => (await header.getByRole("link", { name, exact: true }).boundingBox())!.y;
  expect(Math.abs((await top("Sign in")) - (await top("Start free")))).toBeLessThan(2);
  expect((await header.boundingBox())!.height).toBeLessThan(80);
});
