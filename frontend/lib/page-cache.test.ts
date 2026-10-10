import { afterEach, describe, expect, it, vi } from "vitest";
import { PageCache, pageCache } from "./page-cache";

describe("PageCache", () => {
  it("gives back what was remembered under the same key only", () => {
    const cache = new PageCache(10);
    cache.remember("library:es", ["Le chat"]);
    expect(cache.recall("library:es")).toEqual(["Le chat"]);
    expect(cache.recall("library:fr")).toBeUndefined();
  });

  it("keeps the latest value for a key", () => {
    const cache = new PageCache(10);
    cache.remember("forum", 1);
    cache.remember("forum", 2);
    expect(cache.recall("forum")).toBe(2);
  });

  it("forgets the least recently used key past its limit", () => {
    const cache = new PageCache(2);
    cache.remember("a", 1);
    cache.remember("b", 2);
    cache.recall("a");
    cache.remember("c", 3);
    expect(cache.recall("a")).toBe(1);
    expect(cache.recall("b")).toBeUndefined();
    expect(cache.recall("c")).toBe(3);
  });

  it("re-remembering a key makes it the most recently used", () => {
    const cache = new PageCache(2);
    cache.remember("a", 1);
    cache.remember("b", 2);
    cache.remember("a", 10);
    cache.remember("c", 3);
    expect(cache.recall("a")).toBe(10);
    expect(cache.recall("b")).toBeUndefined();
  });
});

describe("pageCache (the app's instance)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("remembers nothing on the server, where one module is shared by every visitor", () => {
    pageCache.remember("library:es", ["someone else's text"]);
    expect(pageCache.recall("library:es")).toBeUndefined();
  });

  it("remembers in the browser", () => {
    vi.stubGlobal("window", {});
    pageCache.remember("dashboard:week", { known: 5 });
    expect(pageCache.recall("dashboard:week")).toEqual({ known: 5 });
  });
});
