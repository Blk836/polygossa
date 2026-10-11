import { expect, test } from "@playwright/test";
import { formatClock, secondsLeft } from "../lib/writing";
import { answerBox, answerFor, failure, handIn, holdSubmit, ok, proLearner, results, resultsOutline, startTest, top } from "./writing-helpers";

test.describe("handing in a writing test", () => {
  test("handing in replaces the test with an outline of the results", async ({ browser }) => {
    const { context, page } = await proLearner(browser);
    const t = await startTest(page);
    const answer = answerFor(t);
    const submit = holdSubmit(page, [ok(answer)], t);
    await page.goto("/writing");
    await answerBox(page).fill(answer);
    await handIn(page).click();

    await expect(resultsOutline(page)).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
    await expect(answerBox(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Hand in|Grading/ })).toHaveCount(0);
    for (const part of ["score", "rubric", "texts"]) await expect(resultsOutline(page).locator(`[data-skeleton=${part}]`)).toBeVisible();
    const situation = page.getByText(t.prompt, { exact: true });
    const during = await top(situation);

    submit.release();
    await expect(results(page)).toBeVisible();
    await expect(resultsOutline(page)).toHaveCount(0);
    expect(await top(situation)).toBe(during);
    await context.close();
  });

  test("running out of time hands in once, with the clock gone and the outline showing", async ({ browser }) => {
    const { context, page } = await proLearner(browser);
    const t = await startTest(page);
    const submit = holdSubmit(page, [ok("perro gato")], t);
    await page.clock.install();
    await page.goto("/writing");
    await answerBox(page).fill("perro gato");
    await page.clock.fastForward((t.timeLimitSeconds + 1) * 1000);

    await expect(resultsOutline(page)).toBeVisible();
    await expect(page.getByRole("timer")).toHaveCount(0);
    await page.clock.fastForward(10_000);
    expect(submit.calls).toBe(1);

    submit.release();
    await expect(results(page)).toBeVisible();
    expect(submit.calls).toBe(1);
    await context.close();
  });

  test("a failed hand-in puts the test back with the answer and the real time left", async ({ browser }) => {
    const { context, page } = await proLearner(browser);
    const t = await startTest(page);
    const answer = answerFor(t);
    const submit = holdSubmit(page, [failure], t);
    await page.goto("/writing");
    await answerBox(page).fill(answer);
    await handIn(page).click();
    await expect(resultsOutline(page)).toBeVisible();
    submit.release();

    await expect(page.getByText("The server is busy, try again.")).toBeVisible();
    await expect(answerBox(page)).toHaveValue(answer);
    const clock = page.getByRole("timer");
    const shown = await clock.locator("p").first().textContent();
    const now = await page.evaluate(() => Date.now());
    const expected = [secondsLeft(t.deadline, now), secondsLeft(t.deadline, now) + 1].map(formatClock);
    expect(expected).toContain(shown);
    await expect.poll(() => clock.locator("p").first().textContent(), { timeout: 5_000 }).not.toBe(shown);
    await context.close();
  });

  test("a failed hand-in after time ran out waits for the learner to hand in again", async ({ browser }) => {
    const { context, page } = await proLearner(browser);
    const t = await startTest(page);
    const submit = holdSubmit(page, [failure, ok("perro gato")], t);
    submit.release();
    await page.clock.install();
    await page.goto("/writing");
    await answerBox(page).fill("perro gato");
    await page.clock.fastForward((t.timeLimitSeconds + 1) * 1000);

    await expect(page.getByText("The server is busy, try again.")).toBeVisible();
    await expect(page.getByRole("timer")).toContainText("0:00");
    await expect(answerBox(page)).toHaveValue("perro gato");
    await page.clock.fastForward(10_000);
    await expect(handIn(page)).toBeEnabled();
    expect(submit.calls).toBe(1);

    await handIn(page).click();
    await expect(results(page)).toBeVisible();
    expect(submit.calls).toBe(2);
    await context.close();
  });
});
