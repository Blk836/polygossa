import { describe, expect, it } from "vitest";
import { ACTIONS, ADMIN_TABS, actionSummary, adminTab, aiJobName, cents, dollars, LOOKUP_LAYERS, pairName, percent, planCounts, share, usersPath } from "./admin";

describe("usersPath", () => {
  it("searches and pages", () => {
    expect(usersPath("", 0)).toBe("admin/users?page=0");
    expect(usersPath("   ", 1)).toBe("admin/users?page=1");
    expect(usersPath(" ana ", 2)).toBe("admin/users?page=2&q=ana");
  });
});

describe("planCounts", () => {
  it("lists every plan with its share of users", () => {
    expect(planCounts({ free: 6, pro: 3, classroom: 1 })).toEqual([
      { label: "Free", count: 6, percent: 60 },
      { label: "Pro", count: 3, percent: 30 },
      { label: "Classroom", count: 1, percent: 10 },
    ]);
    expect(planCounts({ free: 0, pro: 0, classroom: 0 }).map((p) => p.percent)).toEqual([0, 0, 0]);
  });
});

describe("actions", () => {
  it("each has its button, request and confirmation", () => {
    expect(Object.entries(ACTIONS).map(([k, a]) => [k, a.label, a.method, a.path(7), a.yes, a.danger])).toEqual([
      ["suspend", "Suspend", "POST", "admin/users/7/suspend", "Yes, suspend", true],
      ["unsuspend", "Lift suspension", "POST", "admin/users/7/unsuspend", "Yes, lift suspension", false],
      ["posts", "Remove all forum posts", "DELETE", "admin/users/7/posts", "Yes, remove posts", true],
      ["playlists", "Remove all playlists", "DELETE", "admin/users/7/playlists", "Yes, remove playlists", true],
      ["texts", "Remove all texts and videos", "DELETE", "admin/users/7/texts", "Yes, remove content", true],
      ["unshare", "Unshare everything", "POST", "admin/users/7/unshare", "Yes, unshare", false],
    ]);
    expect(ACTIONS.suspend.confirm("a@b.co")).toBe("Suspend a@b.co?");
    expect(ACTIONS.unsuspend.confirm("a@b.co")).toBe("Lift the suspension of a@b.co?");
    expect(ACTIONS.posts.confirm("a@b.co")).toBe("Remove every forum post by a@b.co? Threads they started go with their replies.");
    expect(ACTIONS.playlists.confirm("a@b.co")).toBe("Remove every playlist by a@b.co?");
    expect(ACTIONS.texts.confirm("a@b.co")).toBe("Remove every text and video a@b.co imported? This can't be undone.");
    expect(ACTIONS.unshare.confirm("a@b.co")).toBe("Make everything a@b.co shared private?");
  });

  it("each asks before it runs, naming the user", () => {
    for (const a of Object.values(ACTIONS)) expect(a.confirm("ana@x.co")).toMatch(/ana@x\.co/);
  });

  it("summarises what an action did", () => {
    expect(actionSummary("posts", { posts: 3, threads: 1 })).toBe("Removed 3 posts (1 thread)");
    expect(actionSummary("posts", { posts: 1, threads: 0 })).toBe("Removed 1 post (0 threads)");
    expect(actionSummary("texts", { texts: 2 })).toBe("Removed 2 texts and videos");
    expect(actionSummary("playlists", { playlists: 1 })).toBe("Removed 1 playlist");
    expect(actionSummary("unshare", { texts: 2, playlists: 0 })).toBe("Made 2 texts and 0 playlists private");
    expect(actionSummary("suspend", {})).toBe("Suspended");
    expect(actionSummary("unsuspend", {})).toBe("Suspension lifted");
  });
});

describe("admin tabs", () => {
  it("each tab has its own address, Overview the page's own", () => {
    expect(ADMIN_TABS.map((t) => [t.label, t.href])).toEqual([
      ["Overview", "/admin"],
      ["Users", "/admin?tab=users"],
      ["Translations", "/admin?tab=translations"],
      ["AI", "/admin?tab=ai"],
      ["Log", "/admin?tab=log"],
    ]);
  });

  it("takes a known tab from the address and otherwise shows Overview", () => {
    expect(adminTab("translations")).toBe("translations");
    expect(adminTab("ai")).toBe("ai");
    expect(adminTab("log")).toBe("log");
    expect(adminTab("users")).toBe("users");
    expect(adminTab(undefined)).toBe("overview");
    expect(adminTab("nonsense")).toBe("overview");
    expect(adminTab("Users")).toBe("overview");
    expect(adminTab(["log", "users"])).toBe("log");
  });
});

describe("AI spending", () => {
  it("names every job the backend counts, and the total row Total", () => {
    expect(["DEFINITION", "EXAMPLE", "TRANSLATION", "WRITING_FEEDBACK", "WRITING_GRADE", "WORD_MEANING", "CONTENT_REVIEW", "TOPIC_TAGS", "TRANSCRIPT_TIDY"].map(aiJobName)).toEqual([
      "Word definitions", "Example sentences", "Translations", "Writing feedback", "Writing test grades", "Word meanings",
      "Content review", "Topic tagging", "Transcript tidying",
    ]);
    expect(aiJobName(null)).toBe("Total");
    expect(aiJobName("SOMETHING_NEW")).toBe("SOMETHING_NEW");
  });
});

describe("translation figures", () => {
  it("names a pair by its languages, and the total row Total", () => {
    expect(pairName("fr", "en")).toBe("French → English");
    expect(pairName("es", "pl")).toBe("Spanish → Polish");
    expect(pairName(null, null)).toBe("Total");
  });

  it("lists the layers in the order a lookup tries them", () => {
    expect(LOOKUP_LAYERS.map((l) => [l.key, l.label])).toEqual([
      ["aiStored", "AI, stored"],
      ["aiNew", "AI, new"],
      ["community", "Community"],
      ["none", "Nothing found"],
    ]);
  });

  it("shows shares as whole percents, and a dash when there is nothing to share", () => {
    expect(share(120, 1000)).toBe("12%");
    expect(share(1, 3)).toBe("33%");
    expect(share(0, 0)).toBe("—");
    expect(percent(0.62)).toBe("62%");
    expect(percent(0)).toBe("0%");
    expect(percent(null)).toBe("—");
  });

  it("shows dollars to the cent, a tiny cost as under a cent, and no cost as a dash", () => {
    expect(dollars(3.21)).toBe("$3.21");
    expect(dollars(1234.5)).toBe("$1,234.50");
    expect(dollars(0)).toBe("$0.00");
    expect(dollars(0.004)).toBe("<$0.01");
    expect(dollars(null)).toBe("—");
  });

  it("charts cost in cents", () => {
    expect(cents(3.21)).toBe(321);
    expect(cents(0.0042)).toBe(0.42);
  });
});
