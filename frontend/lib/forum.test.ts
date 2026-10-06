import { describe, expect, it } from "vitest";
import {
  FORUM_CATEGORIES,
  categoryFromParam,
  forumCategoryLabel,
  forumListPath,
  forumPageHref,
  pageCount,
  postableCategories,
  threadPath,
} from "./forum";

describe("forum categories", () => {
  it("lists Announcements, Bug reports, Ideas and General in that order", () => {
    expect(FORUM_CATEGORIES.map((c) => [c.code, c.label])).toEqual([
      ["announcements", "Announcements"],
      ["bugs", "Bug reports"],
      ["ideas", "Ideas"],
      ["general", "General"],
    ]);
  });

  it("labels a category, and an unknown one by its code", () => {
    expect(forumCategoryLabel("bugs")).toBe("Bug reports");
    expect(forumCategoryLabel("mystery" as never)).toBe("mystery");
  });

  it("offers announcements only to admins", () => {
    expect(postableCategories(false).map((c) => c.code)).toEqual(["bugs", "ideas", "general"]);
    expect(postableCategories(true).map((c) => c.code)).toEqual(["announcements", "bugs", "ideas", "general"]);
  });

  it.each([
    ["bugs", "bugs"],
    ["announcements", "announcements"],
    [null, null],
    ["", null],
    ["chitchat", null],
  ])("reads the category %s from the URL as %s", (param, expected) => {
    expect(categoryFromParam(param)).toBe(expected);
  });
});

describe("forum paths", () => {
  it("builds the thread list request", () => {
    expect(forumListPath(null, 0)).toBe("forum/threads?page=0");
    expect(forumListPath("ideas", 2)).toBe("forum/threads?category=ideas&page=2");
  });

  it("builds the thread request", () => {
    expect(threadPath(7, 0)).toBe("forum/threads/7?page=0");
    expect(threadPath(7, 3)).toBe("forum/threads/7?page=3");
  });

  it("builds the page URL, leaving out defaults", () => {
    expect(forumPageHref(null, 0)).toBe("/forum");
    expect(forumPageHref("bugs", 0)).toBe("/forum?category=bugs");
    expect(forumPageHref(null, 2)).toBe("/forum?page=2");
    expect(forumPageHref("bugs", 1)).toBe("/forum?category=bugs&page=1");
  });
});

describe("pageCount", () => {
  it.each([
    [0, 20, 1],
    [1, 20, 1],
    [20, 20, 1],
    [21, 20, 2],
    [120, 50, 3],
  ])("%i items at %i a page make %i pages", (total, size, pages) => {
    expect(pageCount(total, size)).toBe(pages);
  });
});
