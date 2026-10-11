import { expect, test } from "@playwright/test";
import { addSyncedAudio, cleanUp, createText, TALL, type Created } from "./reader-helpers";

test.use({ viewport: TALL });

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

test("a jump made just as the audio finishes loading isn't undone by the start of the page", async ({ page }) => {
  created = await createText(page, 1000);
  await addSyncedAudio(page, created.id, 1000);
  await page.addInitScript(() => {
    const w = window as unknown as { positions: number[]; presses: number };
    w.positions = [];
    w.presses = 0;
    const own = Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, "currentTime")!;
    Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
      get() { return own.get!.call(this); },
      set(seconds: number) {
        w.positions.push(Math.round(seconds * 1000));
        own.set!.call(this, seconds);
      },
    });
    const shown = new MutationObserver(() => {
      if (w.presses > 0 || !document.body.innerText.includes("16:40")) return;
      w.presses++;
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "]", bubbles: true }));
      shown.disconnect();
    });
    document.addEventListener("DOMContentLoaded", () => {
      shown.observe(document.body, { childList: true, subtree: true, characterData: true });
    });
  });
  await page.goto(`/read/${created.id}`);
  const state = () => page.evaluate(() => {
    const w = window as unknown as { positions: number[]; presses: number };
    return { positions: [...w.positions], presses: w.presses };
  });
  await expect.poll(async () => (await state()).presses).toBe(1);
  await page.waitForTimeout(1000);
  const { positions } = await state();
  const firstJump = positions.findIndex((ms) => ms > 0);
  expect(firstJump, `positions: ${positions.join(", ")}`).toBeGreaterThanOrEqual(0);
  expect(positions.slice(firstJump), `positions: ${positions.join(", ")}`).not.toContain(0);
});
