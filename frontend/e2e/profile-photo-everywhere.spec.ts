import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import { accountButton, cropDialog, me, pick, signUp, stripes, uploadPhoto, type Person } from "./photo-helpers";

test.describe.configure({ mode: "serial" });

const tag = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const ANA = `Ana ${tag}`;
const BEN = `Ben ${tag}`;
let ana: Person, ben: Person, teacher: Person;
let anaPhoto: string;
const made = { texts: [] as [APIRequestContext, number][], threads: [] as number[], playlist: 0, classId: 0 };

async function post<T>(request: APIRequestContext, url: string, data: unknown, method: "post" | "put" | "patch" = "post"): Promise<T> {
  const res = await request[method](url, { data });
  expect(res.ok(), `${method} ${url}: ${res.status()}`).toBe(true);
  return (await res.json().catch(() => null)) as T;
}

async function sharedText(person: Person, title: string): Promise<number> {
  const { id } = await post<{ id: number }>(person.context.request, "/api/texts", { title, language: "es", content: "Hola amigos.", isPublic: true });
  made.texts.push([person.context.request, id]);
  return id;
}

async function expectPhotos(scope: Locator, { ana = true, ben = true } = {}) {
  if (ana) {
    const named = scope.locator("span", { hasText: ANA }).filter({ has: scope.page().getByTestId("avatar") }).last();
    await expect(named.getByTestId("avatar").locator("img")).toHaveAttribute("src", anaPhoto);
  }
  if (ben) {
    const named = scope.locator("span", { hasText: BEN }).filter({ has: scope.page().getByTestId("avatar") }).last();
    await expect(named.getByTestId("avatar")).toHaveText("B");
    await expect(named.getByTestId("avatar")).toHaveAttribute("data-photo", "no");
  }
}

test.beforeAll(async ({ browser }) => {
  [ana, ben, teacher] = await Promise.all([signUp(browser, ANA), signUp(browser, BEN), signUp(browser, `Teacher ${tag}`)]);
  await ana.page.goto("/settings");
  await uploadPhoto(ana.page, await stripes(ana.page, 300, 300));
  anaPhoto = (await me(ana.page)).photoUrl!;
  await post(teacher.context.request, "/api/me/plan", { tier: "CLASSROOM" });
});

test.afterAll(async () => {
  for (const id of made.threads) {
    const res = await ana.context.request.get(`/api/forum/threads/${id}`);
    const first = (await res.json()).posts?.[0];
    if (first) await ana.context.request.delete(`/api/forum/posts/${first.id}`);
  }
  if (made.playlist) await ana.context.request.delete(`/api/playlists/${made.playlist}`);
  for (const [request, id] of made.texts) await request.delete(`/api/texts/${id}`);
  if (made.classId) await teacher.context.request.delete(`/api/classes/${made.classId}`);
  await Promise.all([ana, ben, teacher].map((p) => p.context.close()));
});

test("my own photo shows on the account button and in the open account menu", async () => {
  const { page } = ana;
  await page.goto("/library");
  await expect(accountButton(page).locator("img")).toHaveAttribute("src", anaPhoto);
  await accountButton(page).click();
  await expect(page.getByRole("menu", { name: "Account" }).getByTestId("avatar").locator("img")).toHaveAttribute("src", anaPhoto);
});

test("forum threads and posts show their authors' photos", async () => {
  const thread = (person: Person, title: string) =>
    post<{ id: number }>(person.context.request, "/api/forum/threads", { category: "general", title, body: "Hola" });
  const anas = await thread(ana, `Photo thread ${tag} A`);
  const bens = await thread(ben, `Photo thread ${tag} B`);
  made.threads.push(anas.id, bens.id);
  await post(ben.context.request, `/api/forum/threads/${anas.id}/posts`, { body: "Hi Ana" });

  const { page } = teacher;
  await page.goto("/forum?category=general");
  await expectPhotos(page.getByRole("main"));
  await page.goto(`/forum/${anas.id}`);
  await expectPhotos(page.getByRole("main"));
});

test("Explore cards and the reader show the sharer's photo", async () => {
  const anaTitle = `Photo text ${tag} A`;
  const anaText = await sharedText(ana, anaTitle);
  await sharedText(ben, `Photo text ${tag} B`);

  const { page } = teacher;
  await page.goto("/community");
  await page.getByRole("searchbox", { name: "Search titles" }).fill(`Photo text ${tag}`);
  await expect(page.getByRole("link", { name: anaTitle }).first()).toBeVisible();
  await expectPhotos(page.getByRole("main"));

  await page.goto(`/read/${anaText}`);
  await expectPhotos(page.getByRole("main"), { ben: false });
});

test("a shared playlist's card, pane and page show its owner's photo", async () => {
  const title = `Photo list ${tag}`;
  const { id } = await post<{ id: number }>(ana.context.request, "/api/playlists", { title, language: "es" });
  made.playlist = id;
  await post(ana.context.request, `/api/playlists/${id}/items/${await sharedText(ana, `Photo episode ${tag}`)}`, {}, "put");
  await post(ana.context.request, `/api/playlists/${id}`, { isPublic: true }, "patch");

  const { page } = teacher;
  await page.goto("/community");
  await page.getByRole("searchbox", { name: "Search titles" }).fill(title);
  await page.getByRole("searchbox", { name: "Search titles" }).press("Enter");
  const card = page.getByTestId("playlist-card").filter({ hasText: title });
  await expectPhotos(card, { ben: false });
  await card.getByRole("button", { name: title }).click();
  await expectPhotos(page.getByRole("dialog", { name: title }), { ben: false });

  await page.goto(`/playlists/${id}`);
  await expectPhotos(page.getByRole("main"), { ben: false });
});

test("my class's roster and progress table show students' photos", async () => {
  const cls = await post<{ id: number; joinCode: string }>(teacher.context.request, "/api/classes", { name: `Photo class ${tag}`, language: "es" });
  made.classId = cls.id;
  for (const student of [ana, ben]) await post(student.context.request, "/api/classes/join", { code: cls.joinCode });

  const { page } = teacher;
  await page.goto(`/classes/${cls.id}`);
  await expectPhotos(page.getByRole("table"));
  await expectPhotos(page.getByRole("list").filter({ hasText: ANA }));
});

test("when Ana changes her photo, others see the new one, not a cached copy", async () => {
  await ana.page.goto("/settings");
  await pick(ana.page, await stripes(ana.page, 300, 300, "image/jpeg"), "new.jpg");
  await cropDialog(ana.page).getByRole("button", { name: "Save photo" }).click();
  await expect(cropDialog(ana.page)).toBeHidden();
  const newer = (await me(ana.page)).photoUrl!;
  expect(newer).not.toBe(anaPhoto);
  anaPhoto = newer;

  const page: Page = teacher.page;
  await page.goto(`/forum/${made.threads[0]}`);
  await expectPhotos(page.getByRole("main"));
});
