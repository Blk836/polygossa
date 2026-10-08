// The app's top-level navigation: four tabs (read, practise, see progress, talk), two of them with a sub-tab strip.
// Settings and Classes live in the account menu instead; Settings has its own sub-tab strip. Pure data and helpers, unit-tested.

export interface NavSection {
  href: string;
  label: string;
}

export interface NavGroup {
  key: "library" | "practice" | "progress" | "forum";
  href: string;
  label: string;
  /** Sub-tabs shown under the header on these pages; empty for a single-page tab. */
  sections: NavSection[];
  /** Other paths that light up this tab without showing the sub-tab strip (e.g. the reader). */
  also?: string[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "library",
    href: "/library",
    label: "Library",
    sections: [
      { href: "/library", label: "Mine" },
      { href: "/library/saved", label: "Saved" },
      { href: "/community", label: "Explore" },
      { href: "/playlists", label: "Playlists" },
    ],
    also: ["/import", "/read"],
  },
  {
    key: "practice",
    href: "/review",
    label: "Practice",
    sections: [
      { href: "/review", label: "Review" },
      { href: "/vocabulary", label: "Words" },
      { href: "/writing", label: "Write" },
    ],
  },
  { key: "progress", href: "/dashboard", label: "Progress", sections: [] },
  { key: "forum", href: "/forum", label: "Forum", sections: [] },
];

/** True when `pathname` is `href` or a page under it (`/playlists/12` is under `/playlists`, `/playlistsx` isn't). */
export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/** The top-level tab that the page belongs to, if any. */
export function activeGroup(pathname: string): NavGroup | undefined {
  return NAV_GROUPS.find((g) => [g.href, ...g.sections.map((s) => s.href), ...(g.also ?? [])].some((href) => isUnder(pathname, href)));
}

/** The most specific section containing `pathname` (/library/saved is Saved, not Mine). */
function mostSpecific(sections: NavSection[], pathname: string): NavSection | undefined {
  const matches = sections.filter((s) => isUnder(pathname, s.href));
  return matches.sort((a, b) => b.href.length - a.href.length)[0];
}

/** The sub-tab for this page (the most specific match: /library/saved is Saved, not Mine); undefined without a strip. */
export function activeSection(pathname: string): NavSection | undefined {
  return mostSpecific(NAV_GROUPS.flatMap((g) => g.sections), pathname);
}

/** Settings' sub-tabs, reached from the account menu rather than a top-level tab. */
export const SETTINGS_SECTIONS: NavSection[] = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/subscription", label: "Subscription" },
  { href: "/settings/privacy", label: "Privacy" },
];

/** The Settings sub-tab for this page; undefined outside Settings. */
export function settingsSection(pathname: string): NavSection | undefined {
  return mostSpecific(SETTINGS_SECTIONS, pathname);
}

/** Anchors on the old single Settings page, for bookmarks made before it was split into sub-tabs. */
const OLD_SETTINGS_ANCHORS: Record<string, string> = {
  "#plan": "/settings/subscription",
  "#appearance": "/settings/appearance",
};

/** Where an old /settings#anchor now lives; undefined for any other hash. */
export function settingsHashRedirect(hash: string): string | undefined {
  return Object.hasOwn(OLD_SETTINGS_ANCHORS, hash) ? OLD_SETTINGS_ANCHORS[hash] : undefined;
}

/** Text for the due-cards badge on Practice: nothing when none are due, capped at "99+". */
export function dueBadge(due: number): string | null {
  if (due <= 0) return null;
  return due > 99 ? "99+" : String(due);
}

/** A tab's accessible name: Practice reads out the cards due in full ("Practice, 5 cards due"). */
export function tabName(group: NavGroup, due: number | null): string {
  if (group.key !== "practice" || dueBadge(due ?? 0) === null) return group.label;
  return `${group.label}, ${due} ${due === 1 ? "card" : "cards"} due`;
}
