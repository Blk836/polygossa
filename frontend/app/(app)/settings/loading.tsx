"use client";

import { usePathname } from "next/navigation";
import { SettingsSkeleton } from "@/components/skeletons/pages";
import { settingsSection } from "@/lib/nav";

export default function Loading() {
  return <SettingsSkeleton label={settingsSection(usePathname())?.label ?? "Settings"} />;
}
