import { describe, expect, it } from "vitest";
import { activeGroup, activeSection, dueBadge, NAV_GROUPS, SETTINGS_SECTIONS, settingsHashRedirect, settingsSection, tabName } from "./nav";

describe("nav groups", () => {
  it("has four top-level tabs: Library, Practice, Progress, Forum", () => {
    expect(NAV_GROUPS.map((g) => [g.label, g.href])).toEqual([
      ["Library", "/library"],
      ["Practice", "/review"],
      ["Progress", "/dashboard"],
      ["Forum", "/forum"],
    ]);
  });

  it("groups Mine, Saved, Explore and Playlists, and Review, Words and Write", () => {
    expect(NAV_GROUPS.map((g) => g.sections.map((s) => [s.label, s.href]))).toEqual([
      [
        ["Mine", "/library"],
        ["Saved", "/library/saved"],
        ["Explore", "/community"],
        ["Playlists", "/playlists"],
      ],
      [
        ["Review", "/review"],
        ["Words", "/vocabulary"],
        ["Write", "/writing"],
      ],
      [],
      [],
    ]);
  });
});

describe("activeGroup", () => {
  it.each([
    ["/library", "Library"],
    ["/community", "Library"],
    ["/playlists", "Library"],
    ["/playlists/12", "Library"],
    ["/import", "Library"],
    ["/read/5", "Library"],
    ["/review", "Practice"],
    ["/vocabulary", "Practice"],
    ["/writing", "Practice"],
    ["/dashboard", "Progress"],
    ["/forum", "Forum"],
    ["/forum/12", "Forum"],
    ["/forum/new", "Forum"],
  ])("%s belongs to %s", (path, label) => {
    expect(activeGroup(path)?.label).toBe(label);
  });

  it("/library/saved belongs to Library", () => {
    expect(activeGroup("/library/saved")?.label).toBe("Library");
  });

  it.each(["/settings", "/classes", "/classes/3", "/onboarding", "/", "/libraryx", "/reading", "/forumx"])("%s belongs to no group", (path) => {
    expect(activeGroup(path)).toBeUndefined();
  });
});

describe("activeSection", () => {
  it.each([
    ["/library", "Mine"],
    ["/library/saved", "Saved"],
    ["/community", "Explore"],
    ["/playlists/12", "Playlists"],
    ["/review", "Review"],
    ["/vocabulary", "Words"],
    ["/writing", "Write"],
  ])("%s shows the %s sub-tab", (path, label) => {
    expect(activeSection(path)?.label).toBe(label);
  });

  it.each(["/read/5", "/import", "/dashboard", "/settings", "/playlistsx", "/forum", "/forum/12"])("%s shows no sub-tab strip", (path) => {
    expect(activeSection(path)).toBeUndefined();
  });
});

describe("dueBadge", () => {
  it.each([
    [0, null],
    [-1, null],
    [1, "1"],
    [99, "99"],
    [100, "99+"],
    [5000, "99+"],
  ])("%i due shows %s", (n, text) => {
    expect(dueBadge(n)).toBe(text);
  });
});

describe("tabName", () => {
  const [library, practice] = NAV_GROUPS;
  it.each([
    [null, "Practice"],
    [0, "Practice"],
    [1, "Practice, 1 card due"],
    [153, "Practice, 153 cards due"],
  ])("Practice with %s due is named %s", (due, name) => {
    expect(tabName(practice, due)).toBe(name);
  });

  it("other tabs never mention cards", () => {
    expect(tabName(library, 5)).toBe("Library");
  });
});

describe("group keys", () => {
  it("name each tab for its icon", () => {
    expect(NAV_GROUPS.map((g) => g.key)).toEqual(["library", "practice", "progress", "forum"]);
  });
});

describe("settings sections", () => {
  it("are Profile, Appearance and Subscription", () => {
    expect(SETTINGS_SECTIONS.map((s) => [s.label, s.href])).toEqual([
      ["Profile", "/settings"],
      ["Appearance", "/settings/appearance"],
      ["Subscription", "/settings/subscription"],
    ]);
  });

  it.each([
    ["/settings", "Profile"],
    ["/settings/appearance", "Appearance"],
    ["/settings/subscription", "Subscription"],
  ])("%s shows the %s settings sub-tab", (path, label) => {
    expect(settingsSection(path)?.label).toBe(label);
  });

  it.each(["/classes", "/classes/3", "/library", "/settingsx", "/"])("%s is not a settings page", (path) => {
    expect(settingsSection(path)).toBeUndefined();
  });
});

describe("settingsHashRedirect", () => {
  it.each([
    ["#plan", "/settings/subscription"],
    ["#appearance", "/settings/appearance"],
  ])("%s moves to %s", (hash, href) => {
    expect(settingsHashRedirect(hash)).toBe(href);
  });

  it.each(["", "#", "#other", "plan", "#planx"])("%s stays put", (hash) => {
    expect(settingsHashRedirect(hash)).toBeUndefined();
  });
});
