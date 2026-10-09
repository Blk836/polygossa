"use client";

import { usePathname } from "next/navigation";
import { SettingsSkeleton } from "@/components/skeletons/pages";
import { settingsSection } from "@/lib/nav";

// Inside the Settings layout: its title and tabs stay on screen, only the tab's content shows an outline.
export default function Loading() {
  return <SettingsSkeleton label={settingsSection(usePathname())?.label ?? "Settings"} />;
}
