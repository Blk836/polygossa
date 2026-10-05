import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppNav } from "@/components/app-nav";
import { MeProvider } from "@/components/me-context";
import { backendJson } from "@/lib/server-api";
import type { Me } from "@/lib/types";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const me = await backendJson<Me>("/api/me");
  if (!me) {
    // Expired or invalid session: clear the cookie, then go to login.
    redirect("/api/auth/logout");
  }
  return (
    <MeProvider initial={me}>
      <AppNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-6 md:pb-10">{children}</main>
    </MeProvider>
  );
}
