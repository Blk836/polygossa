import { expect, test } from "@playwright/test";
import {
  cleanUpAfterEach,
  island,
  label,
  map,
  openInFrench,
  province,
  restingZoom,
  transformChanges,
  wordDot,
  world,
  zoom,
} from "./vocab-map-helpers";

// The vocabulary map's camera (docs/acceptance/vocabulary-map.feature): gliding, reduced motion, the wheel, drags, the
// keyboard and phones. The helpers and the shared test user's rules are in vocab-map-helpers.ts.

cleanUpAfterEach();

test("the camera glides, and jumps when the device asks for reduced motion", async ({ page }) => {
  await openInFrench(page);
  await restingZoom(page);
  const glide = await transformChanges(page, () => island(page, "Home").click(), label(page, "province-label", "rooms"));
  expect(glide).toBeGreaterThan(5);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const jump = await transformChanges(page, () => province(page, "Rooms & furniture").click(), wordDot(page, "chambre"));
  expect(jump).toBe(1);
});

test("the wheel zooms around the pointer, a drag pans to the world's edge, and the page still scrolls when zoomed out", async ({ page }) => {
  await openInFrench(page);
  await world(page).scrollIntoViewIfNeeded();
  const out = await restingZoom(page);
  const box = (await world(page).boundingBox())!;

  // Fully zoomed out, scrolling down over the map scrolls the page.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore);
  expect(await zoom(page)).toBeCloseTo(out, 6);

  // Scrolling up over the map zooms it in, and the page stays put.
  const box2 = (await world(page).boundingBox())!;
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  const scrollAt = await page.evaluate(() => window.scrollY);
  await page.mouse.wheel(0, -400);
  expect(await restingZoom(page)).toBeGreaterThan(out * 1.5);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollAt);

  // A drag pans; dragging far stops at the edge of the world.
  const centre = await world(page).getAttribute("data-centre");
  await page.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
  await page.mouse.down();
  await page.mouse.move(box2.x + box2.width / 2 + 120, box2.y + box2.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(world(page)).not.toHaveAttribute("data-centre", centre!);
  // A drag that ends over an island doesn't open it.
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map");

  for (let i = 0; i < 4; i++) {
    await page.mouse.move(box2.x + 20, box2.y + box2.height / 2);
    await page.mouse.down();
    await page.mouse.move(box2.x + box2.width - 20, box2.y + box2.height / 2, { steps: 4 });
    await page.mouse.up();
  }
  await restingZoom(page);
  const [x] = (await world(page).getAttribute("data-centre"))!.split(",").map(Number);
  const k = await zoom(page);
  expect(x).toBeCloseTo(box2.width / (2 * k), -1); // the world's left edge sits at the map's left edge
});

test("islands, provinces and words can be reached with the keyboard and say what they hold", async ({ page }) => {
  await openInFrench(page);
  await island(page, "Food & Drink").focus();
  await page.keyboard.press("Enter");
  await expect(map(page).getByTestId("map-province")).toHaveCount(6);
  await expect(province(page, "Fruit & vegetables")).toHaveAttribute("aria-label", /^Fruit & vegetables: \d+ of \d+ known$/);

  // Provinces come after every island in the tab order.
  await island(page, "Core words").focus();
  await page.keyboard.press("Tab");
  await expect(map(page).getByTestId("map-province").first()).toBeFocused();

  await province(page, "Fruit & vegetables").focus();
  await page.keyboard.press("Enter");
  await expect(wordDot(page, "pomme")).toHaveAttribute("aria-label", "pomme: new");
  await wordDot(page, "pomme").focus();
  await page.keyboard.press("Enter");
  await expect(map(page).getByTestId("map-word-panel")).toContainText("apple");
});

test("the map fits a phone, and at province zoom every word is big enough to tap", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openInFrench(page);
  const mapBox = (await world(page).boundingBox())!;
  const cardBox = (await map(page).boundingBox())!;
  expect(mapBox.width).toBeGreaterThanOrEqual(cardBox.width - 2);
  await expect(world(page)).toHaveCSS("touch-action", "pan-y");
  // Zoomed out on a phone, the island names stay readable: no two labels overlap.
  await expect(map(page).getByTestId("island-label")).toHaveCount(14);
  const labels = await map(page).getByTestId("island-label").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const [a, b] = [labels[i], labels[j]];
      const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      expect(overlap, `labels ${i} and ${j}`).toBeLessThan(Math.min(a.width * a.height, b.width * b.height) * 0.1);
    }
  }

  await island(page, "Food & Drink").click();
  await province(page, "Fruit & vegetables").click();
  await expect(world(page)).toHaveCSS("touch-action", "none");
  await expect(wordDot(page, "pomme")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  for (const term of ["pomme", "banane", "poire"]) {
    const box = (await wordDot(page, term).boundingBox())!;
    expect(box.height, term).toBeGreaterThanOrEqual(44);
  }
});
