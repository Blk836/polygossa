import { expect, test, type Locator } from "@playwright/test";
import {
  bandButton,
  cleanUpAfterEach,
  country,
  label,
  map,
  openInFrench,
  province,
  restingZoom,
  transformChanges,
  wordText,
  wordTile,
  world,
  zoom,
} from "./vocab-map-helpers";

// The vocabulary map's camera and floating controls (docs/acceptance/vocabulary-map.feature): gliding, reduced motion,
// the zoom buttons, the wheel, drags, the keyboard and phones. The helpers and the shared test user's rules are in
// vocab-map-helpers.ts.

cleanUpAfterEach();

async function box(locator: Locator) {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!;
}

test("the controls float over the map's corners", async ({ page }) => {
  await openInFrench(page);
  const frame = await box(world(page));
  const crumbs = await box(map(page).getByTestId("map-breadcrumb"));
  const zoomIn = await box(map(page).getByRole("button", { name: "Zoom in" }));
  const bands = await box(map(page).getByRole("group", { name: "Bands counted" }));
  const legend = await box(map(page).getByTestId("map-legend"));
  const [midX, midY] = [frame.x + frame.width / 2, frame.y + frame.height / 2];
  const inside = (b: typeof frame) => b.x >= frame.x && b.y >= frame.y && b.x + b.width <= frame.x + frame.width && b.y + b.height <= frame.y + frame.height;
  for (const b of [crumbs, zoomIn, bands, legend]) expect(inside(b)).toBe(true);
  expect(crumbs.x + crumbs.width).toBeLessThan(midX);
  expect(crumbs.y + crumbs.height).toBeLessThan(midY);
  expect(zoomIn.x).toBeGreaterThan(midX);
  expect(zoomIn.y + zoomIn.height).toBeLessThan(midY);
  expect(bands.x).toBeGreaterThan(midX);
  expect(bands.y).toBeGreaterThan(midY);
  expect(legend.x + legend.width).toBeLessThan(midX);
  expect(legend.y).toBeGreaterThan(midY);
  await expect(map(page).getByTestId("map-legend")).toHaveText("KnownLearningNew");
});

test("the zoom buttons zoom in around the middle, and out a level at a time", async ({ page }) => {
  await openInFrench(page);
  const out = await restingZoom(page);
  const centre = await world(page).getAttribute("data-centre");
  // The map reports its zoom once the glide comes to rest.
  await map(page).getByRole("button", { name: "Zoom in" }).click();
  await expect.poll(() => zoom(page)).toBeGreaterThan(out * 1.3);
  await expect(world(page)).toHaveAttribute("data-centre", centre!);
  await map(page).getByRole("button", { name: "Zoom out" }).click();
  await expect.poll(() => zoom(page)).toBeCloseTo(out, 3);

  await country(page, "Home").click();
  await province(page, "Rooms & furniture").click();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Home›Rooms & furniture");
  await map(page).getByRole("button", { name: "Zoom out" }).click();
  await expect(map(page).getByTestId("map-breadcrumb")).toHaveText("Map›Home");
});

test("the camera glides, and jumps when the device asks for reduced motion", async ({ page }) => {
  await openInFrench(page);
  await restingZoom(page);
  const glide = await transformChanges(page, () => country(page, "Home").click(), label(page, "area-label", "rooms"));
  expect(glide).toBeGreaterThan(5);

  await page.emulateMedia({ reducedMotion: "reduce" });
  const jump = await transformChanges(page, () => province(page, "Rooms & furniture").click(), wordText(page, "chambre"));
  expect(jump).toBe(1);
});

test("the wheel zooms around the pointer, a drag pans to the world's edge, and the page still scrolls when zoomed out", async ({ page }) => {
  await openInFrench(page);
  await world(page).scrollIntoViewIfNeeded();
  const out = await restingZoom(page);
  const box1 = (await world(page).boundingBox())!;

  // Fully zoomed out, scrolling down over the map scrolls the page.
  await page.mouse.move(box1.x + box1.width / 2, box1.y + box1.height / 2);
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
  // A drag that ends over a country doesn't open it.
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

test("name tags stay on their countries while the map moves", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openInFrench(page);
  await world(page).scrollIntoViewIfNeeded();
  const tag = label(page, "region-label", "food");
  const target = country(page, "Food & Drink");
  const centreOf = async (l: Locator) => {
    const b = (await l.boundingBox())!;
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  };
  const frame = (await world(page).boundingBox())!;
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2);
  const out = await restingZoom(page);
  await page.mouse.wheel(0, -150);
  await expect.poll(() => zoom(page)).toBeGreaterThan(out * 1.1);
  const [t, c] = [await centreOf(tag), await centreOf(target)];
  expect(Math.abs(t.x - c.x)).toBeLessThan(frame.width * 0.08);
  expect(Math.abs(t.y - c.y)).toBeLessThan(frame.height * 0.08);
});

test("countries, provinces and words can be reached with the keyboard and say what they hold", async ({ page }) => {
  await openInFrench(page);
  await country(page, "Food & Drink").focus();
  await page.keyboard.press("Enter");
  await expect(map(page).getByTestId("map-area")).toHaveCount(6);
  await expect(province(page, "Fruit & vegetables")).toHaveAttribute("aria-label", /^Fruit & vegetables: \d+ of \d+ known$/);

  // Provinces come after every country in the tab order.
  await map(page).getByTestId("map-region").last().focus();
  await page.keyboard.press("Tab");
  await expect(map(page).getByTestId("map-area").first()).toBeFocused();

  await province(page, "Fruit & vegetables").focus();
  await page.keyboard.press("Enter");
  await expect(wordTile(page, "pomme")).toHaveAttribute("aria-label", "pomme: new");
  await wordTile(page, "pomme").focus();
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
  expect(mapBox.height).toBeGreaterThan(mapBox.width);
  await expect(world(page)).toHaveCSS("touch-action", "pan-y");
  await expect(bandButton(page, "A1")).toBeVisible();
  // Zoomed out on a phone, the country names stay readable: no two tags overlap.
  await expect(map(page).getByTestId("region-label")).toHaveCount(14);
  const labels = await map(page).getByTestId("region-label").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  for (let i = 0; i < labels.length; i++) {
    for (let j = i + 1; j < labels.length; j++) {
      const [a, b] = [labels[i], labels[j]];
      const overlap = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      expect(overlap, `labels ${i} and ${j}`).toBeLessThan(Math.min(a.width * a.height, b.width * b.height) * 0.1);
    }
  }

  await country(page, "Food & Drink").click();
  await province(page, "Fruit & vegetables").click();
  await expect(world(page)).toHaveCSS("touch-action", "none");
  await expect(wordTile(page, "pomme")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBe(0);
  for (const term of ["pomme", "banane", "poire"]) {
    const tile = (await wordTile(page, term).boundingBox())!;
    expect(tile.height, term).toBeGreaterThanOrEqual(44);
  }
});
