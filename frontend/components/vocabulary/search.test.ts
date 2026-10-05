import { describe, expect, it } from "vitest";
import { PAGE_SIZE, exportParams, pageCount, searchParams } from "./search";

const empty = { language: "", status: "", kind: "", sort: "recent", query: "", page: 0 };

describe("vocabulary search params", () => {
  it("always sends sort and paging, and only the filters that are set", () => {
    expect(searchParams(empty).toString()).toBe(`sort=recent&page=0&size=${PAGE_SIZE}`);
    const all = searchParams({ language: "es", status: "known", kind: "phrase", sort: "alpha", query: "gato", page: 2 });
    expect(Object.fromEntries(all)).toEqual({
      sort: "alpha", page: "2", size: String(PAGE_SIZE), language: "es", status: "known", kind: "phrase", q: "gato",
    });
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
