import { expect, test, type Page } from "@playwright/test";

async function keepStreak(page: Page) {
  const h = { current: 2, activeToday: false };
  await page.route("**/api/dashboard/header*", (route) =>
    route.fulfill({ json: { current: h.current, best: h.current, activeToday: h.activeToday, secondsLeftToday: 3600, knownWords: 10 } }));
  await page.goto("/library");
  await expect(page.getByRole("banner").getByTestId("streak-flame")).toHaveAttribute("data-state", "fading");
  Object.assign(h, { current: 3, activeToday: true });
  await page.getByRole("navigation", { name: "Section" }).getByRole("link", { name: "Explore" }).click();
  const toast = page.getByRole("status").filter({ hasText: "3-day streak kept" });
  await expect(toast).toBeVisible();
  return toast;
}

async function recordLeaving(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { seen: string[] };
    w.seen = [];
    new MutationObserver(() => {
      const el = document.querySelector("[data-leaving]");
      const polly = el?.querySelector("[data-testid=streak-polly]");
      if (el && polly) w.seen.push(`${getComputedStyle(el).animationName}|${getComputedStyle(polly).animationName}|${getComputedStyle(el).pointerEvents}`);
    }).observe(document.body, { attributes: true, subtree: true, childList: true });
  });
  return () => page.evaluate(() => (window as unknown as { seen: string[] }).seen);
}

test("closing the streak message plays Polly's exit before it goes", async ({ page }) => {
  const toast = await keepStreak(page);
  const seen = await recordLeaving(page);
  await toast.getByRole("button", { name: "Close" }).click();
  await expect(toast).toHaveCount(0);
  expect(await seen()).toContain("streak-leave|polly-buzz-off|none");
});

test("the streak message times out with the same exit", async ({ page }) => {
  const toast = await keepStreak(page);
  const seen = await recordLeaving(page);
  await expect(toast).toHaveCount(0, { timeout: 12_000 });
  expect(await seen()).toContain("streak-leave|polly-buzz-off|none");
});

test("pointing at the streak message keeps it until the pointer leaves", async ({ page }) => {
  const toast = await keepStreak(page);
  await toast.hover();
  await page.waitForTimeout(7_000);
  await expect(toast).toBeVisible();
  await expect(toast).not.toHaveAttribute("data-leaving");
  await page.mouse.move(0, 0);
  await expect(toast).toHaveCount(0, { timeout: 12_000 });
});

test("with reduced motion the streak message only fades", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const toast = await keepStreak(page);
  const seen = await recordLeaving(page);
  await toast.getByRole("button", { name: "Close" }).click();
  await expect(toast).toHaveCount(0);
  expect(await seen()).toContain("streak-leave-fade|none|none");
});
