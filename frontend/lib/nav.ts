export interface NavSection {
  href: string;
  label: string;
  also?: string[];
}

export const HOME = "/community";

export interface NavGroup {
  key: "library" | "practice" | "progress" | "forum";
  href: string;
  label: string;
  sections: NavSection[];
  also?: string[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "library",
    href: HOME,
    label: "Library",
    sections: [
      { href: HOME, label: "Explore" },
      { href: "/library", label: "My library", also: ["/playlists"] },
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

export function sectionTourName(label: string): string {
  return label.toLowerCase().replaceAll(" ", "-");
}

export function isUnder(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

export function activeGroup(pathname: string): NavGroup | undefined {
  const paths = (g: NavGroup) => [g.href, ...g.sections.flatMap((s) => [s.href, ...(s.also ?? [])]), ...(g.also ?? [])];
  return NAV_GROUPS.find((g) => paths(g).some((href) => isUnder(pathname, href)));
}

function matchLength(s: NavSection, pathname: string): number {
  return Math.max(-1, ...[s.href, ...(s.also ?? [])].filter((href) => isUnder(pathname, href)).map((href) => href.length));
}

function mostSpecific(sections: NavSection[], pathname: string): NavSection | undefined {
  const matches = sections.filter((s) => matchLength(s, pathname) >= 0);
  return matches.sort((a, b) => matchLength(b, pathname) - matchLength(a, pathname))[0];
}

export function activeSection(pathname: string): NavSection | undefined {
  return mostSpecific(NAV_GROUPS.flatMap((g) => g.sections), pathname);
}

export const SETTINGS_SECTIONS: NavSection[] = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/appearance", label: "Appearance" },
  { href: "/settings/subscription", label: "Subscription" },
  { href: "/settings/privacy", label: "Privacy" },
];

export function settingsSection(pathname: string): NavSection | undefined {
  return mostSpecific(SETTINGS_SECTIONS, pathname);
}

const OLD_SETTINGS_ANCHORS: Record<string, string> = {
  "#plan": "/settings/subscription",
  "#appearance": "/settings/appearance",
};

export function settingsHashRedirect(hash: string): string | undefined {
  return Object.hasOwn(OLD_SETTINGS_ANCHORS, hash) ? OLD_SETTINGS_ANCHORS[hash] : undefined;
}

export function dueBadge(due: number): string | null {
  if (due <= 0) return null;
  return due > 99 ? "99+" : String(due);
}

export function tabName(group: NavGroup, due: number | null): string {
  if (group.key !== "practice" || dueBadge(due ?? 0) === null) return group.label;
  return `${group.label}, ${due} ${due === 1 ? "card" : "cards"} due`;
}
