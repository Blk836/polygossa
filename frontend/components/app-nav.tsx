"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType, SVGProps } from "react";
import { AccountMenu } from "./account-menu";
import { HeaderStats } from "./header-stats";
import { BookIcon, CardsIcon, ChartIcon, ChatIcon } from "./icons";
import { LanguageSwitcher } from "./language-switcher";
import { useMe } from "./me-context";
import { useDueCount, useHeaderStats } from "./nav-data";
import { Logo } from "./ui";
import { BRAND } from "@/lib/brand";
import {
  activeGroup,
  activeSection,
  dueBadge,
  HOME,
  NAV_GROUPS,
  sectionTourName,
  SETTINGS_SECTIONS,
  settingsSection,
  tabName,
  type NavGroup,
  type NavSection,
} from "@/lib/nav";

const ICONS: Record<NavGroup["key"], ComponentType<SVGProps<SVGSVGElement>>> = {
  library: BookIcon,
  practice: CardsIcon,
  progress: ChartIcon,
  forum: ChatIcon,
};

function TabLabel({ group, due }: { group: NavGroup; due: number | null }) {
  const badge = group.key === "practice" && due !== null ? dueBadge(due) : null;
  return (
    <>
      {group.label}
      {badge && (
        <span data-testid="due-badge" aria-hidden className="ml-1.5 rounded-full bg-rubric px-1.5 py-px text-[11px] leading-4 font-semibold text-paper tabular-nums">
          {badge}
        </span>
      )}
    </>
  );
}

function SubTabs({ label, sections, current }: { label: string; sections: NavSection[]; current: NavSection }) {
  return (
    <nav aria-label={label} className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4">
      {sections.map((s) => {
        const here = s.href === current.href;
        return (
          <Link
            key={s.href}
            href={s.href}
            data-tour={sectionTourName(s.label)}
            aria-current={here ? "page" : undefined}
            className={`relative shrink-0 px-3 py-2 text-sm transition ${
              here ? "font-medium text-ink after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-rubric" : "text-muted hover:text-ink"
            }`}
          >
            {s.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SectionTabs({ pathname }: { pathname: string }) {
  const section = activeSection(pathname);
  const group = activeGroup(pathname);
  if (section && group) return <SubTabs label="Section" sections={group.sections} current={section} />;
  const setting = settingsSection(pathname);
  if (setting) return <SubTabs label="Settings pages" sections={SETTINGS_SECTIONS} current={setting} />;
  return null;
}

export function AppNav() {
  const pathname = usePathname();
  const { me } = useMe();
  const language = me.targetLanguage ?? "";
  const due = useDueCount(language, pathname, me);
  const stats = useHeaderStats(language, pathname, me);
  const active = activeGroup(pathname);

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-4">
          <Link href={HOME} aria-label={`${BRAND} home`} className="min-w-0 truncate">
            <Logo className="text-xl sm:text-2xl" />
          </Link>
          <nav className="hidden flex-1 items-center gap-1 md:flex" aria-label="Main">
            {NAV_GROUPS.map((g) => (
              <Link
                key={g.key}
                href={g.href}
                aria-label={tabName(g, due)}
                aria-current={g === active ? "page" : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${g === active ? "bg-card font-medium text-ink" : "text-muted hover:text-ink"}`}
              >
                <TabLabel group={g} due={due} />
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2 md:ml-0">
            {stats && <HeaderStats stats={stats} />}
            <LanguageSwitcher />
            <AccountMenu />
          </div>
        </div>
        <SectionTabs pathname={pathname} />
      </header>

      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-paper/95 pt-1.5 backdrop-blur md:hidden"
        aria-label="Main"
      >
        {NAV_GROUPS.map((g) => {
          const Icon = ICONS[g.key];
          return (
            <Link
              key={g.key}
              href={g.href}
              aria-label={tabName(g, due)}
              aria-current={g === active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-xs ${g === active ? "font-medium text-rubric" : "text-muted"}`}
            >
              <Icon />
              <span>
                <TabLabel group={g} due={due} />
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
