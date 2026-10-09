import { describe, expect, it } from "vitest";
import { PAGE_SIZE, exportParams, initialStatus, pageCount, parseTags, searchParams } from "./search";

const empty = { language: "", status: "", kind: "", sort: "recent", query: "", tag: "", page: 0 };

describe("vocabulary search params", () => {
  it("always sends sort and paging, and only the filters that are set", () => {
    expect(searchParams(empty).toString()).toBe(`sort=recent&page=0&size=${PAGE_SIZE}`);
    const all = searchParams({ language: "es", status: "known", kind: "phrase", sort: "alpha", query: "gato", tag: "pets", page: 2 });
    expect(Object.fromEntries(all)).toEqual({
      sort: "alpha", page: "2", size: String(PAGE_SIZE), language: "es", status: "known", kind: "phrase", q: "gato", tag: "pets",
    });
  });

  it("reads tags typed with commas or spaces, lower-cased, without duplicates", () => {
    expect(parseTags("Animals, pets  food-words,animals")).toEqual(["animals", "pets", "food-words"]);
    expect(parseTags(" , ")).toEqual([]);
    expect(parseTags("")).toEqual([]);
  });

  it("export links carry only language and status", () => {
    expect(exportParams({ language: "", status: "" }).toString()).toBe("");
    expect(exportParams({ language: "fr", status: "learning" }).toString()).toBe("language=fr&status=learning");
  });

  it("counts pages", () => {
    expect(pageCount(0)).toBe(0);
    expect(pageCount(PAGE_SIZE)).toBe(1);
    expect(pageCount(PAGE_SIZE + 1)).toBe(2);
  });
});

describe("initialStatus", () => {
  it("opens on a status named in the address (the vocabulary map's Beyond the core link)", () => {
    expect(initialStatus("known")).toBe("known");
    expect(initialStatus("ignored")).toBe("ignored");
    expect(initialStatus("learning")).toBe("learning");
  });

  it("opens on learning words otherwise", () => {
    expect(initialStatus(null)).toBe("learning");
    expect(initialStatus("everything")).toBe("learning");
  });
});
