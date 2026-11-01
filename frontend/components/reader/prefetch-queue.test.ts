import { describe, expect, it } from "vitest";
import { MAX_AHEAD, prefetchQueue } from "./prefetch-queue";

function controlled() {
  const asked: string[] = [];
  const settle = new Map<string, { ok: () => void; fail: () => void }>();
  const fetch = (k: string) => {
    asked.push(k);
    return new Promise<void>((ok, no) => settle.set(k, { ok, fail: () => no(new Error("down")) }));
  };
  return { asked, settle, fetch };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("prefetchQueue", () => {
  it("asks for wanted words in order, at most four at a time", async () => {
    expect(MAX_AHEAD).toBe(4);
    const c = controlled();
    const q = prefetchQueue(c.fetch);
    q.want(["a", "b", "c", "d", "e", "f"]);
    expect(c.asked).toEqual(["a", "b", "c", "d"]);
    c.settle.get("b")!.ok();
    await tick();
    expect(c.asked).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("asks for each word once", async () => {
    const c = controlled();
    const q = prefetchQueue(c.fetch);
    q.want(["a"]);
    c.settle.get("a")!.ok();
    await tick();
    q.want(["a", "b"]);
    q.want(["b", "a"]);
    expect(c.asked).toEqual(["a", "b"]);
  });

  it("drops waiting words the pointer has left", async () => {
    const c = controlled();
    const q = prefetchQueue(c.fetch);
    q.want(["a", "b", "c", "d", "e", "f"]);
    q.want(["x"]);
    c.settle.get("a")!.ok();
    await tick();
    expect(c.asked).toEqual(["a", "b", "c", "d", "x"]);
  });

  it("forgets everything waiting when cleared", async () => {
    const c = controlled();
    const q = prefetchQueue(c.fetch);
    q.want(["a", "b", "c", "d", "e"]);
    q.clear();
    c.settle.get("a")!.ok();
    await tick();
    expect(c.asked).toEqual(["a", "b", "c", "d"]);
  });

  it("frees the slot of a failed request, quietly", async () => {
    const c = controlled();
    const q = prefetchQueue(c.fetch);
    q.want(["a", "b", "c", "d", "e"]);
    c.settle.get("a")!.fail();
    await tick();
    expect(c.asked).toEqual(["a", "b", "c", "d", "e"]);
  });
});
