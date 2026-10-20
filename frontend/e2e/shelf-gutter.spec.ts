import { expect, test, type Page } from "@playwright/test";

let created: number[] = [];

async function fillShelf(page: Page) {
  await page.goto("/library");
  const me = await (await page.request.get("/api/me")).json();
  const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
  for (let i = 0; i < 4; i++) {
    const res = await page.request.post("/api/texts", {
      data: { title: `Gutter ${i} ${stamp}`, language: me.targetLanguage ?? "fr", content: "Le train part à midi. Il fait beau.", isPublic: true, category: "travel" },
    });
    expect(res.ok(), await res.text()).toBe(true);
    created.push((await res.json()).id);
  }
}

test.afterEach(async ({ page }) => {
  for (const id of created) await page.request.delete(`/api/texts/${id}`);
  created = [];
});

async function tracks(page: Page) {
  const track = page.locator("main section [class*='snap-x']");
  await expect(track.first().locator(":scope > *").first()).toBeVisible();
  await page.waitForTimeout(300);
  return track.evaluateAll((els) => els.map((el) => {
    const heading = el.closest("section")?.querySelector("h2, h3");
    return {
      scrollLeft: el.scrollLeft,
      first: (el.firstElementChild as HTMLElement).getBoundingClientRect().left,
      heading: heading ? heading.getBoundingClientRect().left : null,
    };
  }));
}

test("on a phone every shelf starts at the 16 px gutter", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fillShelf(page);
  await page.goto("/community");
  const rows = await tracks(page);
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    expect(row.scrollLeft).toBe(0);
    expect(Math.round(row.first)).toBe(16);
  }
});

test("on a laptop every shelf's first card lines up with its heading", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await fillShelf(page);
  await page.goto("/community");
  for (const row of await tracks(page)) {
    expect(row.scrollLeft).toBe(0);
    if (row.heading !== null) expect(Math.round(row.first)).toBe(Math.round(row.heading));
  }
});
