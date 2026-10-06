import { expect, test } from "@playwright/test";
import { accountButton, cropDialog, me, pick, profileAvatar, signUp, stripes, uploadPhoto, type Person } from "./photo-helpers";

// Feature: Profile photo (docs/acceptance/profile-photo.feature): failure paths, phone width and dark mode.

let ana: Person;

test.afterEach(async () => {
  await ana.context.close();
});

test.describe("on a desktop", () => {
  test.beforeEach(async ({ browser }) => {
    ana = await signUp(browser, "ana");
    await ana.page.goto("/settings");
  });

  test("a file that isn't an image is refused before any crop or upload", async () => {
    const { page } = ana;
    for (const [name, mimeType] of [["cv.pdf", "application/pdf"], ["notes.txt", "text/plain"]]) {
      await pick(page, Buffer.from("not an image"), name, mimeType);
      await expect(page.getByRole("alert")).toHaveText("Please choose a JPEG, PNG or WebP image");
      await expect(cropDialog(page)).toHaveCount(0);
    }
    expect((await me(page)).photoUrl).toBeNull();
  });

  test("an image the browser can't read is refused", async () => {
    const { page } = ana;
    await pick(page, Buffer.from([0xff, 0xd8, 0xff, 1, 2, 3, 4, 5]), "photo.jpg");
    await expect(page.getByRole("alert")).toHaveText("That image couldn't be read. Try another one.");
    await expect(cropDialog(page)).toHaveCount(0);
    await expect(profileAvatar(page)).toHaveText("A");
  });

  test("an image over 20 MB is refused", async () => {
    const { page } = ana;
    await pick(page, Buffer.alloc(20 * 1024 * 1024 + 1), "huge.png");
    await expect(page.getByRole("alert")).toHaveText("That image is too large (max 20 MB)");
    await expect(cropDialog(page)).toHaveCount(0);
  });

  test("while saving, the button reads Saving… and is disabled; a failed upload keeps the dialog open to retry", async () => {
    const { page } = ana;
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    await page.route("**/api/me/photo", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await held;
      await route.fulfill({ status: 500, json: { code: "error", message: "The upload failed" } });
    });
    await pick(page, await stripes(page, 300, 300), "me.png");
    await cropDialog(page).getByRole("button", { name: "Save photo" }).click();
    await expect(cropDialog(page).getByRole("button", { name: "Saving…" })).toBeDisabled();
    release();
    await expect(cropDialog(page).getByRole("alert")).toHaveText("The upload failed");
    await expect(cropDialog(page).getByRole("button", { name: "Save photo" })).toBeEnabled();
    await expect(profileAvatar(page)).toHaveText("A");

    await page.unroute("**/api/me/photo");
    await cropDialog(page).getByRole("button", { name: "Save photo" }).click();
    await expect(cropDialog(page)).toBeHidden();
    await expect(profileAvatar(page)).toHaveAttribute("data-photo", "yes");
  });

  test("a failed remove shows an error and keeps the photo", async () => {
    const { page } = ana;
    await uploadPhoto(page, await stripes(page, 300, 300));
    await page.route("**/api/me/photo", (route) => (route.request().method() === "DELETE" ? route.abort() : route.continue()));
    await page.getByRole("button", { name: "Remove photo" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(profileAvatar(page)).toHaveAttribute("data-photo", "yes");
    await expect(page.getByRole("button", { name: "Remove photo" })).toBeEnabled();
  });

  test("a photo that fails to load falls back to the initial", async () => {
    const { page } = ana;
    await uploadPhoto(page, await stripes(page, 300, 300));
    await page.route("**/api/users/*/photo*", (route) => route.abort());
    await page.reload();
    await expect(profileAvatar(page)).toHaveText("A");
    await expect(profileAvatar(page)).toHaveAttribute("data-photo", "no");
    await expect(accountButton(page)).toHaveText("A");
  });

  test("in dark mode the crop dialog and placeholder use the dark theme's colours", async () => {
    const { page } = ana;
    await page.emulateMedia({ colorScheme: "dark" });
    const background = (selector: string) => page.locator(selector).first().evaluate((el) => getComputedStyle(el).backgroundColor);
    const card = await page.getByRole("region", { name: "Profile photo" }).evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(card).not.toBe("rgb(255, 255, 255)");
    await pick(page, await stripes(page, 300, 300), "me.png");
    expect(await background("dialog")).toBe(card);
  });
});

test("at phone width the photo controls and the crop dialog fit, and a finger can drag", async ({ browser }) => {
  ana = await signUp(browser, "ana", { width: 390, height: 800 }, true);
  const { page } = ana;
  await page.goto("/settings");
  await uploadPhoto(page, await stripes(page, 300, 300));
  for (const name of ["Change photo", "Remove photo"]) {
    const box = (await page.getByRole("button", { name }).boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

  await pick(page, await stripes(page, 1200, 800), "wide.png");
  for (const part of [page.getByTestId("crop-frame"), cropDialog(page).getByRole("slider"), cropDialog(page).getByRole("button", { name: "Save photo" })]) {
    const box = (await part.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(800);
  }
  const frame = page.getByTestId("crop-frame");
  const image = page.getByTestId("crop-image");
  const before = (await image.boundingBox())!.x;
  const box = (await frame.boundingBox())!;
  // A real touch drag, through Chrome's DevTools protocol (Playwright's touchscreen only taps).
  const cdp = await page.context().newCDPSession(page);
  const touch = (type: "touchStart" | "touchMove" | "touchEnd", dx: number) => cdp.send("Input.dispatchTouchEvent", {
    type, touchPoints: type === "touchEnd" ? [] : [{ x: box.x + box.width / 2 + dx, y: box.y + box.height / 2 }],
  });
  await touch("touchStart", 0);
  for (const dx of [-10, -20, -30]) await touch("touchMove", dx);
  await touch("touchEnd", -30);
  expect((await image.boundingBox())!.x).toBeCloseTo(before - 30, 0);
});
