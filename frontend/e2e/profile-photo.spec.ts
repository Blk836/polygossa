import { expect, test, type Page } from "@playwright/test";
import {
  accountButton, coloursAt, cropDialog, me, pick, profileAvatar, signUp, stripes, uploadPhoto, type Person,
} from "./photo-helpers";

let ana: Person;

test.beforeEach(async ({ browser }) => {
  ana = await signUp(browser, "ana");
  await ana.page.goto("/settings");
});

test.afterEach(async () => {
  await ana.context.close();
});

const save = (page: Page) => cropDialog(page).getByRole("button", { name: "Save photo" });

test("with no photo, Profile and the account menu show my initial", async () => {
  const { page } = ana;
  await expect(profileAvatar(page)).toHaveText("A");
  await expect(profileAvatar(page)).toHaveAttribute("data-photo", "no");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove photo" })).toHaveCount(0);
  await expect(accountButton(page)).toHaveText("A");
});

test("uploading a photo shows it on Profile and in the account menu, and it stays after reloading", async () => {
  const { page } = ana;
  await pick(page, await stripes(page, 600, 600, "image/jpeg"), "me.jpg");
  await expect(cropDialog(page)).toBeVisible();
  expect((await me(page)).photoUrl).toBeNull();
  await save(page).click();
  await expect(cropDialog(page)).toBeHidden();

  const url = (await me(page)).photoUrl!;
  expect(url).toMatch(/^\/api\/users\/\d+\/photo\?v=/);
  await expect(profileAvatar(page).locator("img")).toHaveAttribute("src", url);
  await expect(accountButton(page).locator("img")).toHaveAttribute("src", url);
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Remove photo" })).toBeVisible();
  const served = await coloursAt(page, url, [[0.5, 0.5]]);
  expect(served.size).toEqual([256, 256]);
  expect(served.type).toBe("image/jpeg");

  await page.reload();
  await expect(profileAvatar(page).locator("img")).toHaveAttribute("src", url);
  await expect(accountButton(page).locator("img")).toHaveAttribute("src", url);
});

for (const [file, type] of [["me.jpg", "image/jpeg"], ["me.png", "image/png"], ["me.webp", "image/webp"]]) {
  test(`a ${type} image can be uploaded`, async () => {
    const { page } = ana;
    await uploadPhoto(page, await stripes(page, 300, 300, type), file);
    await expect(profileAvatar(page)).toHaveAttribute("data-photo", "yes");
  });
}

test("the crop starts centred: a landscape photo keeps its middle square, not squashed", async () => {
  const { page } = ana;
  await uploadPhoto(page, await stripes(page, 1200, 800));
  const { colours } = await coloursAt(page, (await me(page)).photoUrl!, [[0.1, 0.5], [0.5, 0.5], [0.9, 0.5]]);
  expect(colours).toEqual(["red", "green", "blue"]);
});

test("dragging moves the image, stopping at its edge, and the saved photo is what was in the frame", async () => {
  const { page } = ana;
  await pick(page, await stripes(page, 1200, 800), "wide.png");
  const frame = page.getByTestId("crop-frame");
  const box = (await frame.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2 + 200, { steps: 5 });
  await page.mouse.up();

  const image = (await page.getByTestId("crop-image").boundingBox())!;
  expect(image.x).toBeLessThanOrEqual(box.x + 0.5);
  expect(image.y).toBeLessThanOrEqual(box.y + 0.5);
  expect(image.x + image.width).toBeGreaterThanOrEqual(box.x + box.width - 0.5);
  expect(image.y + image.height).toBeGreaterThanOrEqual(box.y + box.height - 0.5);

  await save(page).click();
  await expect(cropDialog(page)).toBeHidden();
  const { colours } = await coloursAt(page, (await me(page)).photoUrl!, [[0.1, 0.5], [0.45, 0.5], [0.9, 0.5]]);
  expect(colours).toEqual(["red", "red", "green"]);
});

test("zooming in with the slider saves the zoomed-in middle", async () => {
  const { page } = ana;
  await pick(page, await stripes(page, 1200, 800), "wide.png");
  await cropDialog(page).getByRole("slider", { name: "Zoom" }).fill("4");
  await save(page).click();
  await expect(cropDialog(page)).toBeHidden();
  const { colours } = await coloursAt(page, (await me(page)).photoUrl!, [[0.05, 0.05], [0.95, 0.95]]);
  expect(colours).toEqual(["green", "green"]);
});

test("the arrow keys move the image and + zooms it", async () => {
  const { page } = ana;
  await pick(page, await stripes(page, 1200, 800), "wide.png");
  const frame = page.getByTestId("crop-frame");
  await frame.focus();
  for (let i = 0; i < 6; i++) await frame.press("ArrowLeft");
  const before = (await page.getByTestId("crop-image").boundingBox())!.width;
  await frame.press("+");
  await frame.press("-");
  expect((await page.getByTestId("crop-image").boundingBox())!.width).toBeCloseTo(before, 0);
  await save(page).click();
  await expect(cropDialog(page)).toBeHidden();
  const { colours } = await coloursAt(page, (await me(page)).photoUrl!, [[0.05, 0.5], [0.45, 0.5], [0.55, 0.5], [0.95, 0.5]]);
  expect(colours).toEqual(["green", "green", "blue", "blue"]);
});

for (const how of ["Cancel", "Escape"]) {
  test(`${how} closes the crop dialog without uploading, and the same file can be picked again`, async () => {
    const { page } = ana;
    const file = await stripes(page, 300, 300);
    await pick(page, file, "me.png");
    await expect(cropDialog(page)).toBeVisible();
    if (how === "Escape") await page.keyboard.press("Escape");
    else await cropDialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(cropDialog(page)).toBeHidden();
    expect((await me(page)).photoUrl).toBeNull();
    await expect(profileAvatar(page)).toHaveText("A");
    await pick(page, file, "me.png");
    await expect(cropDialog(page)).toBeVisible();
  });
}

test("location data in a photo is not kept", async () => {
  const { page } = ana;
  const jpeg = await stripes(page, 300, 300, "image/jpeg");
  const payload = Buffer.from("Exif\0\0MM\0*\0\0\0\x08GPSLatitude 51.5074 N GPSLongitude 0.1278 W", "latin1");
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, 0, payload.length + 2]), payload]);
  const tagged = Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
  expect(tagged.includes("GPSLatitude")).toBe(true);
  await uploadPhoto(page, tagged, "holiday.jpg");
  const stored = Buffer.from(await (await page.request.get((await me(page)).photoUrl!)).body());
  expect(stored.includes("GPS")).toBe(false);
  expect(stored.includes("Exif")).toBe(false);
});

test("changing the photo replaces it everywhere", async () => {
  const { page } = ana;
  await uploadPhoto(page, await stripes(page, 300, 300));
  const first = (await me(page)).photoUrl!;
  const newer = await stripes(page, 300, 300, "image/jpeg");
  const [chooser] = await Promise.all([page.waitForEvent("filechooser"), page.getByRole("button", { name: "Change photo" }).click()]);
  await chooser.setFiles({ name: "new.jpg", mimeType: "image/jpeg", buffer: newer });
  await cropDialog(page).getByRole("button", { name: "Save photo" }).click();
  await expect(cropDialog(page)).toBeHidden();
  const second = (await me(page)).photoUrl!;
  expect(second).not.toBe(first);
  await expect(accountButton(page).locator("img")).toHaveAttribute("src", second);
  expect((await page.request.get(first)).status()).toBe(200);
  expect((await coloursAt(page, first, [[0.5, 0.5]])).type).toBe("image/jpeg");
});

test("removing the photo brings the initial back, also after reloading", async () => {
  const { page } = ana;
  await uploadPhoto(page, await stripes(page, 300, 300));
  await page.getByRole("button", { name: "Remove photo" }).click();
  await expect(profileAvatar(page)).toHaveText("A");
  await expect(accountButton(page)).toHaveText("A");
  await expect(page.getByRole("button", { name: "Upload photo" })).toBeVisible();
  await page.reload();
  await expect(profileAvatar(page)).toHaveText("A");
  expect((await me(page)).photoUrl).toBeNull();
});

test("uploading a photo leaves an unsaved name in the Name field, unsaved", async () => {
  const { page } = ana;
  await page.getByLabel("Name").fill("Ana Typed");
  await uploadPhoto(page, await stripes(page, 300, 300));
  await expect(page.getByLabel("Name")).toHaveValue("Ana Typed");
  expect((await me(page)).displayName).toBe("ana");
});
