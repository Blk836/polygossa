import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { CognitoContinue } from "@/components/cognito-continue";
import { Logo } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { cognitoConfig } from "@/lib/cognito";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  // The splash starts in the language picked on the landing page, if any (auth-splash.feature).
  const { lang } = await searchParams;
  return (
    <AuthShell copy="Every word you learn makes the next page easier." start={typeof lang === "string" ? lang : null}>
      <Link href="/" className="mb-6 block text-center lg:mb-8" aria-label={`${BRAND} home`}><Logo className="text-4xl" /></Link>
      <h1 className="mb-1 text-center font-display text-2xl font-semibold">Start reading in two minutes</h1>
      <p className="mb-6 text-center text-sm text-muted">Free forever for 5 texts and 500 saved words.</p>
      {cognitoConfig() ? (
        <CognitoContinue screen="signup" />
      ) : (
        <Suspense>
          <AuthForm mode="signup" />
        </Suspense>
      )}
      <p className="mt-4 text-center text-xs text-muted">
        By creating an account you agree to the <Link href="/terms" className="underline">terms</Link> and
        the <Link href="/privacy" className="underline">privacy policy</Link>.
      </p>
    </AuthShell>
  );
}
