import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import type { ThreadList, ThreadPage, ThreadSummary } from "../lib/forum";

// The forum: docs/acceptance/forum.feature. The test account is a forum admin in development (FORUM_ADMINS), so
// learner views are checked by stubbing canModerate off. Threads made here are deleted afterwards.

const made: number[] = [];

async function createThread(request: APIRequestContext, category: string, body = "First message"): Promise<ThreadSummary> {
  const res = await request.post("/api/forum/threads", { data: { category, title: `E2E ${Date.now()} ${Math.random()}`, body } });
  expect(res.status()).toBe(201);
  const thread = (await res.json()) as ThreadSummary;
  made.push(thread.id);
  return thread;
}

/** Signs in (auto-login) so page.request carries the session. */
async function signIn(page: Page) {
  await page.goto("/forum");
}

async function asLearner(page: Page) {
  const learner = async (route: import("@playwright/test").Route) => {
    const res = await route.fetch();
    await route.fulfill({ response: res, json: { ...(await res.json()), canModerate: false } });
  };
  await page.route(/\/api\/forum\/threads(\/\d+)?(\?.*)?$/, (route) => (route.request().method() === "GET" ? learner(route) : route.fallback()));
}

test.afterEach(async ({ page }) => {
  for (const id of made.splice(0)) {
    const res = await page.request.get(`/api/forum/threads/${id}`);
    if (!res.ok()) continue;
    const first = ((await res.json()) as ThreadPage).posts[0];
    await page.request.delete(`/api/forum/posts/${first.id}`);
  }
});

test("the Forum tab in the top bar opens the forum", async ({ page }) => {
  await page.goto("/library");
  await page.getByRole("banner").getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Forum" }).click();
  await page.waitForURL("**/forum");
  await expect(page.getByRole("navigation", { name: "Forum categories" }).getByRole("link"))
    .toHaveText(["All", "Announcements", "Bug reports", "Ideas", "General"]);
});

test("starting a thread lands on it with my first post", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "New thread" }).click();
  await page.getByLabel("Category").selectOption("bugs");
  const title = `Crash on import ${Date.now()}`;
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Message").fill("It crashes when I import a video.");
  await page.getByRole("button", { name: "Post" }).click();
  await page.waitForURL(/\/forum\/\d+$/);
  made.push(Number(page.url().split("/").pop()));
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.getByTestId("forum-post")).toHaveCount(1);
  await expect(page.getByTestId("forum-post")).toContainText("It crashes when I import a video.");
});

test("category tabs filter the list and set the URL", async ({ page }) => {
  await signIn(page);
  const bug = await createThread(page.request, "bugs");
  const idea = await createThread(page.request, "ideas");
  await page.goto("/forum");
  await page.getByRole("navigation", { name: "Forum categories" }).getByRole("link", { name: "Bug reports" }).click();
  await page.waitForURL("**/forum?category=bugs");
  await expect(page.getByTestId("forum-thread").filter({ hasText: bug.title })).toBeVisible();
  await expect(page.getByTestId("forum-thread").filter({ hasText: idea.title })).toHaveCount(0);
});

test("replies are plain text, keep their line breaks, and bump the thread", async ({ page }) => {
  await signIn(page);
  const thread = await createThread(page.request, "general");
  await page.goto(`/forum/${thread.id}`);
  await page.getByLabel("Your reply").fill("<b>hi</b>\n\nsecond line");
  await page.getByRole("button", { name: "Reply" }).click();
  const reply = page.getByTestId("forum-post").nth(1);
  await expect(reply).toContainText("<b>hi</b>");
  await expect(reply.locator("b")).toHaveCount(0);
  expect(await reply.locator("p.whitespace-pre-wrap").innerText()).toBe("<b>hi</b>\n\nsecond line");
  const list = (await (await page.request.get("/api/forum/threads?category=general")).json()) as ThreadList;
  expect(list.threads.find((t) => t.id === thread.id)?.replies).toBe(1);
});

test("I can edit my post, and delete a reply after confirming", async ({ page }) => {
  await signIn(page);
  const thread = await createThread(page.request, "general");
  await page.request.post(`/api/forum/threads/${thread.id}/posts`, { data: { body: "A reply to remove" } });
  await page.goto(`/forum/${thread.id}`);
  const first = page.getByTestId("forum-post").first();
  await first.getByRole("button", { name: "Edit" }).click();
  await first.getByLabel("Edit post").fill("Edited message");
  await first.getByRole("button", { name: "Save" }).click();
  await expect(first).toContainText("Edited message");
  await expect(first).toContainText("edited");

  const reply = page.getByTestId("forum-post").nth(1);
  await reply.getByRole("button", { name: "Delete" }).click();
  await expect(reply).toContainText("Delete this post?");
  await reply.getByRole("button", { name: "Yes, delete" }).click();
  await expect(page.getByTestId("forum-post")).toHaveCount(1);
});

test("deleting the first post deletes the thread", async ({ page }) => {
  await signIn(page);
  const thread = await createThread(page.request, "general");
  await page.goto(`/forum/${thread.id}`);
  const first = page.getByTestId("forum-post").first();
  await first.getByRole("button", { name: "Delete" }).click();
  await expect(first).toContainText("Delete the whole thread?");
  await first.getByRole("button", { name: "Yes, delete" }).click();
  await page.waitForURL(/\/forum$/);
  expect((await page.request.get(`/api/forum/threads/${thread.id}`)).status()).toBe(404);
});

test("admins pin and lock threads", async ({ page }) => {
  await signIn(page);
  const thread = await createThread(page.request, "general");
  await page.goto(`/forum/${thread.id}`);
  await page.getByRole("button", { name: "Pin", exact: true }).click();
  await expect(page.getByRole("heading", { name: thread.title })).toContainText("Pinned");
  await page.goto("/forum");
  await expect(page.getByTestId("forum-thread").first()).toContainText(thread.title);
  await expect(page.getByTestId("forum-thread").first()).toContainText("Pinned");

  await page.goto(`/forum/${thread.id}`);
  await page.getByRole("button", { name: "Unpin" }).click();
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  await expect(page.getByText("Locked: no new replies")).toBeVisible();
  await expect(page.getByLabel("Your reply")).toHaveCount(0);
  await page.getByRole("button", { name: "Unlock" }).click();
  await expect(page.getByLabel("Your reply")).toBeVisible();
});

test("learners see no pin or lock buttons and can't start announcements", async ({ page }) => {
  await signIn(page);
  const thread = await createThread(page.request, "general");
  await asLearner(page);
  await page.goto(`/forum/${thread.id}`);
  await expect(page.getByTestId("forum-post")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Pin", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Lock", exact: true })).toHaveCount(0);
  await page.goto("/forum/new");
  await expect(page.getByLabel("Category").locator("option")).toHaveText(["Bug reports", "Ideas", "General"]);
});

test("admins can start announcements", async ({ page }) => {
  await signIn(page);
  await page.goto("/forum/new");
  await expect(page.getByLabel("Category").locator("option")).toHaveText(["Announcements", "Bug reports", "Ideas", "General"]);
});

test("at phone width the forum doesn't scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page);
  await createThread(page.request, "general");
  await page.goto("/forum");
  await expect(page.getByTestId("forum-thread").first()).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
