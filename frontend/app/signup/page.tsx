import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // The splash starts in the language picked on the landing page, if any (auth-splash.feature).
  const { lang } = await searchParams;
  return (
    <AuthShell copy="Every word you learn makes the next page easier." start={typeof lang === "string" ? lang : null}>
      <h1 className="mb-1 text-center font-display text-2xl font-semibold">Start reading in two minutes</h1>
      <p className="mb-6 text-center text-sm text-muted">Free forever for 5 texts and 500 saved words.</p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
