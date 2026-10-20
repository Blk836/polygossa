import { expect, test, type Browser } from "@playwright/test";
import { signUp } from "./photo-helpers";

async function classWith(browser: Browser, students: number) {
  const teacher = await signUp(browser, "Count teacher");
  expect((await teacher.context.request.post("/api/me/plan", { data: { tier: "CLASSROOM" } })).ok()).toBe(true);
  const cls = await (await teacher.context.request.post("/api/classes", { data: { name: `Cuenta ${students}`, language: "es" } })).json();
  const others = [];
  for (let i = 0; i < students; i++) {
    const s = await signUp(browser, `Count student ${i}`);
    expect((await s.context.request.post("/api/classes/join", { data: { code: cls.joinCode } })).ok()).toBe(true);
    others.push(s);
  }
  return { teacher, cls, close: async () => { for (const p of [teacher, ...others]) await p.context.close(); } };
}

for (const [n, text] of [[0, "0 students"], [1, "1 student"], [2, "2 students"]] as const) {
  test(`a class with ${n} students says "${text}"`, async ({ browser }) => {
    const { teacher, cls, close } = await classWith(browser, n);
    await teacher.page.goto("/classes");
    await expect(teacher.page.getByRole("main")).toContainText(`Spanish · ${text}`);
    await expect(teacher.page.getByRole("main")).not.toContainText(`Spanish · ${text}s`);
    await teacher.page.goto(`/classes/${cls.id}`);
    await expect(teacher.page.getByRole("main")).toContainText(`Spanish · ${text}`);
    await expect(teacher.page.getByRole("main")).not.toContainText(`Spanish · ${text}s`);
    await close();
  });
}
