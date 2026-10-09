import { describe, expect, it } from "vitest";
import {
  emptyTitle,
  extraFilterCount,
  filterPills,
  hasFilters,
  librarySubtitle,
  NO_FILTERS,
  shownItems,
  showLabel,
  sourceFromParam,
  uniqueById,
  type LibraryFilters,
} from "./library-filters";

const f = (patch: Partial<LibraryFilters>): LibraryFilters => ({ ...NO_FILTERS, ...patch });

describe("extraFilterCount", () => {
  it("counts the filters behind the Filters button (type and source), not the category chips", () => {
    expect(extraFilterCount(f({}))).toBe(0);
    expect(extraFilterCount(f({ category: "news" }))).toBe(0);
    expect(extraFilterCount(f({ kind: "video" }))).toBe(1);
    expect(extraFilterCount(f({ source: "saved" }))).toBe(1);
    expect(extraFilterCount(f({ kind: "text", source: "imported", category: "news" }))).toBe(2);
  });
});

describe("hasFilters", () => {
  it.each([
    [f({}), false],
    [f({ category: "news" }), true],
    [f({ kind: "video" }), true],
    [f({ source: "imported" }), true],
  ] as const)("%o → %s", (filters, yes) => {
    expect(hasFilters(filters)).toBe(yes);
  });
});

describe("filterPills", () => {
  it("names each filter set behind the button, with what removing it leaves", () => {
    expect(filterPills(f({}))).toEqual([]);
    expect(filterPills(f({ kind: "video", source: "saved", category: "news" }))).toEqual([
      { label: "Videos", without: f({ source: "saved", category: "news" }) },
      { label: "Saved", without: f({ kind: "video", category: "news" }) },
    ]);
    expect(filterPills(f({ source: "imported" }))).toEqual([{ label: "Imported", without: f({}) }]);
  });
});

describe("showLabel", () => {
  it.each([
    [0, "Show 0 items"],
    [1, "Show 1 item"],
    [23, "Show 23 items"],
  ])("%i reads %s", (n, text) => {
    expect(showLabel(n)).toBe(text);
  });
});

describe("emptyTitle", () => {
  it.each([
    [f({}), "es", "No Spanish texts or videos yet"],
    [f({ kind: "video" }), "es", "No Spanish videos yet"],
    [f({ kind: "text" }), "", "No texts yet"],
    [f({ source: "saved" }), "fr", "No saved French texts or videos"],
    [f({ source: "saved", kind: "video" }), "", "No saved videos"],
    [f({ source: "imported" }), "", "No imported texts or videos"],
    [f({ kind: "video", category: "news" }), "es", "No Spanish videos in News & society"],
    [f({ source: "saved", category: "stories" }), "", "No saved texts or videos in Stories"],
  ] as const)("%o in %s → %s", (filters, language, title) => {
    expect(emptyTitle(filters, language)).toBe(title);
  });
});

describe("uniqueById", () => {
  it("keeps the first list's items, then the second's that aren't in it, in order", () => {
    const a = [{ id: 1, from: "a" }, { id: 2, from: "a" }];
    const b = [{ id: 3, from: "b" }, { id: 2, from: "b" }, { id: 4, from: "b" }];
    expect(uniqueById(a, b)).toEqual([{ id: 1, from: "a" }, { id: 2, from: "a" }, { id: 3, from: "b" }, { id: 4, from: "b" }]);
    expect(uniqueById([], b)).toEqual(b);
    expect(uniqueById(a, [])).toEqual(a);
  });
});

describe("shownItems", () => {
  const items = [
    { id: 1, mine: true, category: "news" },
    { id: 2, mine: false, category: "news" },
    { id: 3, mine: false, category: "stories" },
  ] as const;
  const ids = (filters: LibraryFilters) => shownItems([...items], filters).map((t) => t.id);

  it("shows everything without filters", () => expect(ids(f({}))).toEqual([1, 2, 3]));
  it("Imported is what's mine", () => expect(ids(f({ source: "imported" }))).toEqual([1]));
  it("Saved is what isn't mine", () => expect(ids(f({ source: "saved" }))).toEqual([2, 3]));
  it("a category narrows it", () => expect(ids(f({ category: "news" }))).toEqual([1, 2]));
  it("source and category together", () => expect(ids(f({ source: "saved", category: "news" }))).toEqual([2]));
});

describe("sourceFromParam", () => {
  it.each([
    ["saved", "saved"],
    ["imported", "imported"],
    ["all", "all"],
    [undefined, "all"],
    ["nonsense", "all"],
    [["saved", "imported"], "saved"],
  ] as const)("%o → %s", (param, source) => {
    expect(sourceFromParam(param as string | string[] | undefined)).toBe(source);
  });
});

describe("librarySubtitle", () => {
  it("on the free plan, counts imports only and says saved items don't count", () => {
    expect(librarySubtitle(3, 5, "es")).toBe("3 of 5 imported texts and videos on the free plan (all languages). Saved items don't count.");
  });

  it("without a limit, says what the page holds, in the language", () => {
    expect(librarySubtitle(3, null, "es")).toBe("Spanish texts and videos you imported or saved");
    expect(librarySubtitle(0, null, "")).toBe("Texts and videos you imported or saved");
  });
});

describe("NO_FILTERS", () => {
  it("shows every kind, from every source, in every category", () => {
    expect(NO_FILTERS).toEqual({ kind: "all", category: null, source: "all" });
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });
});
