import { describe, expect, it } from "vitest";
import { PAGE_SIZE, exportParams, initialStatus, pageCount, parseTags, searchParams, sortForKind } from "./search";

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

  it("sorted by most met, export links carry the sort and the top-N cap", () => {
    expect(exportParams({ language: "fr", status: "learning", sort: "met" }, 100).toString())
      .toBe("language=fr&status=learning&sort=met&limit=100");
    expect(exportParams({ language: "fr", status: "", sort: "met" }).toString()).toBe("language=fr&sort=met");
    expect(exportParams({ language: "fr", status: "", sort: "alpha" }, 100).toString()).toBe("language=fr");
  });

  it("phrases have no most-met sort, so switching to them goes back to most recent", () => {
    expect(sortForKind("met", "phrase")).toBe("recent");
    expect(sortForKind("met", "word")).toBe("met");
    expect(sortForKind("alpha", "phrase")).toBe("alpha");
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
