import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui";

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      {children}
    </div>
  );
}
