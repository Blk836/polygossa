import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AnkiAutoSync } from "@/components/anki-auto-sync";
import { AppNav } from "@/components/app-nav";
import { FeatureTour } from "@/components/feature-tour";
import { MeProvider } from "@/components/me-context";
import { PageRestartProvider, RestartablePage } from "@/components/page-restart";
import { backendJson } from "@/lib/server-api";
import type { Me } from "@/lib/types";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await backendJson<Me>("/api/me");
  if (!me) {
    redirect("/api/auth/logout");
  }
  return (
    <MeProvider initial={me}>
      <PageRestartProvider>
        <AppNav />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-10"><RestartablePage>{children}</RestartablePage></main>
        <FeatureTour />
        <AnkiAutoSync />
      </PageRestartProvider>
    </MeProvider>
  );
}
