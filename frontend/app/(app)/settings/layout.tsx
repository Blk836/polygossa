import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";

/** Settings' pages (Profile, Appearance, Subscription); the sub-tab strip between them is in the header (AppNav). */
export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      {children}
    </div>
  );
}
