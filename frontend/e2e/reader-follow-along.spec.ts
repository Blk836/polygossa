import { expect, test, type Locator, type Page } from "@playwright/test";
import { addSyncedAudio, article, cleanUp, createText, openReader, PER_SENTENCE, player, setReaderCookie, wordAt, type Created } from "./reader-helpers";

// docs/acceptance/follow-along-marker.feature: while audio plays, the spoken sentence is tinted and a marker slides
// under the spoken word. 40 words over 12 seconds of audio: a word every 0.3 s.

let created: Created | null = null;

test.afterEach(async ({ page }) => {
  await cleanUp(page, created);
  created = null;
});

interface Move {
  kind: string;
  ms: number;
  /** The vertical position of each keyframe, from its translate(). */
  ys: number[];
}

/** Records every animation the marker runs, with the move it made (its data-move) and its keyframes' heights. */
async function recordMoves(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __moves: unknown[] };
    w.__moves = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const el = this as HTMLElement;
      if (el.dataset?.testid === "follow-marker") {
        const frames = (Array.isArray(keyframes) ? keyframes : []) as Keyframe[];
        const ys = frames.map((f) => Number(/translate\([^,]+,\s*([-\d.]+)px\)/.exec(String(f.transform ?? ""))?.[1] ?? NaN));
        w.__moves.push({ kind: el.dataset.move, ms: typeof options === "number" ? options : options?.duration, ys });
      }
      return animate.call(this, keyframes, options);
    };
  });
}

const moves = (page: Page) => page.evaluate(() => (window as unknown as { __moves: Move[] }).__moves);
const clearMoves = (page: Page) => page.evaluate(() => ((window as unknown as { __moves: Move[] }).__moves = []));

const marker = (page: Page) => page.getByTestId("follow-marker");
const speaking = (page: Page) => article(page).locator(".w-speaking");
const spokenGap = (page: Page) => article(page).locator("span.s-spoken:not(.w)").first();

async function openWithAudio(page: Page) {
  created = await createText(page, 40);
  await addSyncedAudio(page, created.id, 12);
  await openReader(page, `/read/${created.id}`);
  await expect(player(page)).toContainText("0:12"); // metadata loaded
}

/** Plays from the second sentence for a moment, then pauses: the marker stays on the word paused on. */
async function playThenPause(page: Page, ms = 600) {
  await page.keyboard.press("]");
  await expect(speaking(page)).toHaveCount(1);
  await page.waitForTimeout(ms);
  await page.keyboard.press(" ");
  await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
}

async function tokenColour(page: Page, name: string): Promise<string> {
  return page.evaluate((v) => {
    const probe = document.createElement("span");
    probe.style.background = `var(${v})`;
    document.querySelector("article")!.appendChild(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  }, name);
}

const background = (el: Locator) => el.evaluate((e) => getComputedStyle(e).backgroundColor);

/** The marker is shown, as wide as the word and just under it. */
async function expectMarkerUnder(page: Page, word: Locator) {
  await expect
    .poll(async () => {
      const [m, w] = await Promise.all([marker(page).boundingBox(), word.boundingBox()]);
      const opacity = await marker(page).evaluate((e) => getComputedStyle(e).opacity);
      if (!m || !w) return "missing";
      return {
        shown: opacity === "1",
        alignedLeft: Math.abs(m.x - w.x) < 1.5,
        sameWidth: Math.abs(m.width - w.width) < 1.5,
        justBelow: m.y >= w.y + w.height - 0.5 && m.y <= w.y + w.height + 8,
      };
    })
    .toEqual({ shown: true, alignedLeft: true, sameWidth: true, justBelow: true });
}

test.describe("the word marker", () => {
  test("underlines the spoken word, which keeps its own colour", async ({ page }) => {
    await openWithAudio(page);
    await playThenPause(page);
    const word = speaking(page);
    await expect(word).toHaveClass(/w-new/);
    expect(await background(word)).toBe(await tokenColour(page, "--w-new"));
    await expectMarkerUnder(page, word);
    expect(await background(marker(page))).toBe(await tokenColour(page, "--w-marker"));
    expect(await background(marker(page))).not.toBe(await tokenColour(page, "--w-learning-line"));
  });

  test("slides along a line, hops across line breaks, and never two words at once", async ({ page }) => {
    await page.setViewportSize({ width: 380, height: 900 }); // a few words a line, so playback crosses line breaks
    await recordMoves(page);
    await openWithAudio(page);
    await page.keyboard.press("]");
    await page.waitForTimeout(3000); // about ten words
    await page.keyboard.press(" ");
    const all = await moves(page);
    const slides = all.filter((m) => m.kind === "slide");
    const hops = all.filter((m) => m.kind === "hop");
    expect(slides.length, JSON.stringify(all)).toBeGreaterThan(2);
    expect(hops.length, JSON.stringify(all)).toBeGreaterThan(0);
    for (const s of slides) {
      expect(s.ms).toBeLessThanOrEqual(150);
      expect(new Set(s.ys).size, "a slide stays on its line").toBe(1);
    }
    expect(await page.getByTestId("follow-marker").count()).toBe(1);
    await expect(speaking(page)).toHaveCount(1);
  });

  test("jumping to another sentence hops instead of sliding across the words between", async ({ page }) => {
    await recordMoves(page);
    await openWithAudio(page);
    await playThenPause(page);
    await clearMoves(page);
    await page.keyboard.press("]");
    await expect(speaking(page)).toHaveCount(1);
    await expect.poll(async () => (await moves(page)).map((m) => m.kind)[0]).toBe("hop");
  });

  test("moves without animating when the device asks for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await recordMoves(page);
    await openWithAudio(page);
    await playThenPause(page, 1200);
    expect(await moves(page)).toEqual([]);
    await expectMarkerUnder(page, speaking(page));
  });

  test("stays on the word when paused, and goes with the tint when the player closes", async ({ page }) => {
    await openWithAudio(page);
    await playThenPause(page);
    const index = await speaking(page).getAttribute("data-i");
    await page.waitForTimeout(1000);
    await expect(speaking(page)).toHaveAttribute("data-i", index!);
    await expectMarkerUnder(page, speaking(page));
    await player(page).getByRole("button", { name: "Close player" }).click();
    await expect(marker(page)).toHaveCount(0);
    await expect(article(page).locator(".s-spoken")).toHaveCount(0);
  });

  test("follows the word when the text reflows", async ({ page }) => {
    await openWithAudio(page);
    await playThenPause(page);
    await page.getByRole("button", { name: "Reader settings" }).click();
    await page.getByRole("button", { name: "Larger text" }).click();
    await page.getByRole("button", { name: "Larger text" }).click();
    await expectMarkerUnder(page, speaking(page));
    await page.setViewportSize({ width: 500, height: 900 });
    await expectMarkerUnder(page, speaking(page));
  });

  test("fades in on the new page when playback turns the page, without sliding there", async ({ page }) => {
    await recordMoves(page);
    created = await createText(page, 1000);
    await addSyncedAudio(page, created.id, 300); // 0.3 s a word
    await openReader(page, `/read/${created.id}`);
    await expect(player(page)).toContainText("5:00");
    const last = article(page).locator(".w").last();
    const lastIndex = Number(await last.getAttribute("data-i"));
    await last.click();
    await page.getByRole("button", { name: "Play from here" }).click();
    await expect(article(page).locator(`[data-i="${lastIndex}"]`)).toHaveCount(0, { timeout: 5000 }); // page turned
    await page.keyboard.press(" "); // measured paused: while playing, the marker spends half of each word sliding
    await expect(player(page).getByRole("button", { name: "Play", exact: true })).toBeVisible();
    await expect(speaking(page)).toHaveCount(1);
    await expectMarkerUnder(page, speaking(page));
    const afterTurn = (await moves(page)).map((m) => m.kind);
    expect(afterTurn, JSON.stringify(afterTurn)).toContain("show");
    expect(afterTurn.at(afterTurn.lastIndexOf("show") - 1) ?? "", "no move straight across the page turn").not.toMatch(/slide/);
  });
});

test.describe("the sentence tint", () => {
  test("tints the sentence being spoken, behind words without colour, and nothing else", async ({ page }) => {
    await openWithAudio(page);
    const c = created!;
    // A known word in the second sentence (no colour of its own) and one in the third.
    for (const n of [PER_SENTENCE + 3, 2 * PER_SENTENCE + 3]) {
      const res = await page.request.post("/api/vocabulary", { data: { language: c.language, term: c.word(n), displayTerm: c.word(n), kind: "word", status: "known" } });
      expect(res.ok(), await res.text()).toBe(true);
    }
    await openReader(page, `/read/${c.id}`);
    await playThenPause(page);
    const tint = await tokenColour(page, "--w-sentence");
    await expect.poll(() => background(wordAt(page, PER_SENTENCE + 3))).toBe(tint);
    expect(await background(wordAt(page, 2 * PER_SENTENCE + 3))).toBe("rgba(0, 0, 0, 0)");
    expect(await background(wordAt(page, PER_SENTENCE + 1))).toBe(await tokenColour(page, "--w-new")); // new stays blue
    await expect.poll(() => background(spokenGap(page))).toBe(tint);
    for (const n of [0, PER_SENTENCE - 1, 2 * PER_SENTENCE]) await expect(wordAt(page, n)).not.toHaveClass(/s-spoken/);
    for (let n = PER_SENTENCE; n < 2 * PER_SENTENCE; n++) await expect(wordAt(page, n)).toHaveClass(/s-spoken/);
  });

  test("moves to the next sentence as playback crosses into it", async ({ page }) => {
    await openWithAudio(page);
    await page.keyboard.press("]");
    await expect(wordAt(page, PER_SENTENCE)).toHaveClass(/s-spoken/);
    await expect(wordAt(page, 2 * PER_SENTENCE)).toHaveClass(/s-spoken/, { timeout: 5000 });
    await expect(wordAt(page, PER_SENTENCE)).not.toHaveClass(/s-spoken/);
  });
});

test.describe("choosing what to show", () => {
  test("Follow along: Sentence shows the tint without the marker, and is remembered", async ({ page }) => {
    await openWithAudio(page);
    await page.getByRole("button", { name: "Reader settings" }).click();
    const follow = page.getByRole("dialog", { name: "Reader settings" }).getByLabel("Follow along");
    await expect(follow).toHaveValue("word");
    await follow.selectOption({ label: "Sentence" });
    await follow.blur(); // playback shortcuts don't reach a focused dropdown
    await page.keyboard.press("Escape");
    await playThenPause(page);
    await expect(article(page).locator(".s-spoken").first()).toBeVisible();
    await expect(marker(page)).toHaveCount(0);
    await openReader(page, `/read/${created!.id}`);
    await page.getByRole("button", { name: "Reader settings" }).click();
    await expect(page.getByRole("dialog", { name: "Reader settings" }).getByLabel("Follow along")).toHaveValue("sentence");
  });

  test("defaults to sentence and word", async ({ page }) => {
    await setReaderCookie(page, "");
    await openWithAudio(page);
    await playThenPause(page);
    await expect(article(page).locator(".s-spoken").first()).toBeVisible();
    await expectMarkerUnder(page, speaking(page));
  });
});

test.describe("with looking things up", () => {
  test("a selected word stays selected, with the marker under it", async ({ page }) => {
    await openWithAudio(page);
    await playThenPause(page);
    const word = speaking(page);
    await word.click();
    await expect(word).toHaveClass(/w-selected/);
    const selected = await tokenColour(page, "--w-active");
    await expect.poll(() => background(word)).toBe(selected); // the colour change is animated
    await expectMarkerUnder(page, word);
  });
});
