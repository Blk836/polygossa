import Link from "next/link";
import type { ReactNode } from "react";
import { AuthSplash } from "@/components/auth-splash";
import { Logo } from "@/components/ui";
import { BRAND } from "@/lib/brand";

/** The sign-in and sign-up pages: the splash beside the form on wide screens, a band above it on phones. */
export function AuthShell({ copy, start, children }: { copy: string; start?: string | null; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <AuthSplash copy={copy} start={start} />
      <div className="flex flex-1 items-center justify-center px-4 py-8 lg:py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-6 block text-center lg:mb-8" aria-label={`${BRAND} home`}><Logo className="text-4xl" /></Link>
          {children}
        </div>
      </div>
    </div>
  );
}
