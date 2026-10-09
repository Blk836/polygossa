import type { ReactNode } from "react";
import { AuthSplash } from "@/components/auth-splash";

export function AuthShell({ copy, start, children }: { copy: string; start?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <AuthSplash copy={copy} start={start} />
      <div className="flex flex-1 items-center justify-center px-4 py-8 lg:py-12">
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </div>
  );
}
