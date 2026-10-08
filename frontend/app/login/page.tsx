import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { CognitoContinue } from "@/components/cognito-continue";
import { Logo } from "@/components/ui";
import { BRAND } from "@/lib/brand";
import { cognitoConfig } from "@/lib/cognito";

export const metadata: Metadata = { title: "Sign in" };

const text = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <AuthShell copy="Pick up where you left off.">
      <Link href="/" className="mb-6 block text-center lg:mb-8" aria-label={`${BRAND} home`}><Logo className="text-4xl" /></Link>
      <h1 className="mb-6 text-center font-display text-2xl font-semibold">Welcome back</h1>
      {cognitoConfig() ? (
        <CognitoContinue screen="login" next={text(next)} error={text(error)} />
      ) : (
        <Suspense>
          <AuthForm mode="login" />
        </Suspense>
      )}
    </AuthShell>
  );
}
