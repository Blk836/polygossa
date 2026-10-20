import { expect, test, type Page } from "@playwright/test";
import { bandButton, cleanUpAfterEach, map, openInFrench } from "./vocab-map-helpers";

cleanUpAfterEach();

async function overlaps(page: Page) {
  const labels = await map(page).getByTestId("region-label").evaluateAll((els) =>
    els.map((e) => {
      const parts = [...e.children].map((c) => c.getBoundingClientRect().toJSON());
      return { id: e.getAttribute("data-id"), parts };
    }),
  );
  const hits: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      for (const a of labels[i].parts) {
        for (const b of labels[j].parts) {
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 0 && h > 0) hits.push(`${labels[i].id} × ${labels[j].id}`);
        }
      }
    }
  }
  return [...new Set(hits)];
}

for (const width of [1400, 1024]) {
  test(`at ${width} px no country's name or count touches another's`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openInFrench(page);
    for (const band of ["A1", "A2", "B1"]) {
      await bandButton(page, band).click();
      await map(page).scrollIntoViewIfNeeded();
      await expect.poll(() => map(page).getByTestId("region-label").count()).toBeGreaterThanOrEqual(10);
      expect(await overlaps(page), `up to ${band}`).toEqual([]);
    }
  });
}
