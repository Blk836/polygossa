import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import type { Me } from "../lib/types";

export type Person = { context: BrowserContext; page: Page; me: Me };

export async function signUp(browser: Browser, name: string, viewport = { width: 1280, height: 900 }, hasTouch = false): Promise<Person> {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport, hasTouch });
  const email = `photo-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
  const res = await context.request.post("/api/auth/signup", { data: { email, password: "password123", displayName: name } });
  expect(res.ok()).toBe(true);
  expect((await context.request.patch("/api/me", { data: { tours: false } })).ok()).toBe(true);
  const page = await context.newPage();
  return { context, page, me: (await (await context.request.get("/api/me")).json()) as Me };
}

export async function me(page: Page): Promise<Me> {
  return (await (await page.request.get("/api/me")).json()) as Me;
}

export async function stripes(page: Page, width: number, height: number, type = "image/png"): Promise<Buffer> {
  if (page.url() === "about:blank") await page.goto("/settings");
  const dataUrl = await page.evaluate(({ width, height, type }) => {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const ctx = c.getContext("2d")!;
    ["#ff0000", "#00ff00", "#0000ff"].forEach((colour, i) => {
      ctx.fillStyle = colour;
      ctx.fillRect((i * width) / 3, 0, width / 3 + 1, height);
    });
    return c.toDataURL(type, 0.95);
  }, { width, height, type });
  return Buffer.from(dataUrl.split(",")[1], "base64");
}

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export async function pick(page: Page, buffer: Buffer, name: string, mimeType = MIME[name.split(".").pop()!]) {
  await page.getByTestId("photo-input").setInputFiles({ name, mimeType, buffer });
}

export const cropDialog = (page: Page) => page.getByRole("dialog", { name: "Crop your photo" });
export const photoSection = (page: Page) => page.getByRole("region", { name: "Profile photo" });
export const profileAvatar = (page: Page) => photoSection(page).getByTestId("avatar");
export const accountButton = (page: Page) => page.getByRole("banner").getByRole("button", { name: "Account" });

export async function uploadPhoto(page: Page, buffer: Buffer, name = "me.png") {
  await pick(page, buffer, name);
  await cropDialog(page).getByRole("button", { name: "Save photo" }).click();
  await expect(cropDialog(page)).toBeHidden();
}

export async function coloursAt(page: Page, url: string, points: [number, number][]) {
  return page.evaluate(async ({ url, points }) => {
    const res = await fetch(url);
    const bitmap = await createImageBitmap(await res.blob());
    const c = document.createElement("canvas");
    c.width = bitmap.width;
    c.height = bitmap.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const name = ([r, g, b]: Uint8ClampedArray) => (r > 200 && g < 60 && b < 60 ? "red" : g > 200 && r < 60 && b < 60 ? "green"
      : b > 200 && r < 60 && g < 60 ? "blue" : `rgb(${r},${g},${b})`);
    return {
      size: [bitmap.width, bitmap.height],
      type: res.headers.get("content-type"),
      colours: points.map(([x, y]) => name(ctx.getImageData(Math.floor(x * bitmap.width), Math.floor(y * bitmap.height), 1, 1).data)),
    };
  }, { url, points });
}
