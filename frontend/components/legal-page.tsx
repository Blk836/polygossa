import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "./ui";
import { BRAND } from "@/lib/brand";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/" aria-label={`${BRAND} home`}><Logo className="text-2xl" /></Link>
          <nav className="flex gap-4 text-sm text-muted" aria-label="Legal">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <p role="note" className="mb-6 rounded-lg border border-line bg-card px-4 py-3 text-sm">
          <strong>Draft.</strong> This text hasn&apos;t been reviewed by a lawyer yet and will change before {BRAND}{" "}
          opens to the public. Parts in [brackets] are still to be filled in.
        </p>
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {updated}</p>
        <div className="legal mt-6 space-y-4 leading-relaxed [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
      </main>
    </div>
  );
}
