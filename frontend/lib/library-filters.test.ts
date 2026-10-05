import { describe, expect, it } from "vitest";
import { emptyTitle, extraFilterCount, hasFilters, NO_FILTERS, showLabel } from "./library-filters";

describe("extraFilterCount", () => {
  it("counts the filters behind the Filters button, not the category chips", () => {
    expect(extraFilterCount({ kind: "all", category: null })).toBe(0);
    expect(extraFilterCount({ kind: "all", category: "news" })).toBe(0);
    expect(extraFilterCount({ kind: "video", category: null })).toBe(1);
    expect(extraFilterCount({ kind: "text", category: "news" })).toBe(1);
  });
});

describe("hasFilters", () => {
  it.each([
    [{ kind: "all", category: null }, false],
    [{ kind: "all", category: "news" }, true],
    [{ kind: "video", category: null }, true],
  ] as const)("%o → %s", (f, yes) => {
    expect(hasFilters(f)).toBe(yes);
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
    ["mine", "all", null, "es", "No Spanish texts or videos yet"],
    ["mine", "video", null, "es", "No Spanish videos yet"],
    ["mine", "text", null, "", "No texts yet"],
    ["saved", "all", null, "fr", "No saved French texts or videos"],
    ["saved", "video", null, "", "No saved videos"],
    ["mine", "video", "news", "es", "No Spanish videos in News & society"],
    ["saved", "all", "stories", "", "No saved texts or videos in Stories"],
  ] as const)("%s, %s, %s, %s → %s", (view, kind, category, language, title) => {
    expect(emptyTitle(view, { kind, category }, language)).toBe(title);
  });
});

describe("NO_FILTERS", () => {
  it("shows every kind in every category", () => {
    expect(NO_FILTERS).toEqual({ kind: "all", category: null });
    expect(hasFilters(NO_FILTERS)).toBe(false);
  });
});
