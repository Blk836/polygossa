import { describe, expect, it } from "vitest";
import { ACTIONS, actionSummary, planCounts, usersPath } from "./admin";

describe("usersPath", () => {
  it("searches and pages", () => {
    expect(usersPath("", 0)).toBe("admin/users?page=0");
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
