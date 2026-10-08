import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { AuthShell } from "@/components/auth-shell";
import { Logo } from "@/components/ui";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell copy="Pick up where you left off.">
      <Link href="/" className="mb-6 block text-center lg:mb-8" aria-label={`${BRAND} home`}><Logo className="text-4xl" /></Link>
      <h1 className="mb-6 text-center font-display text-2xl font-semibold">Welcome back</h1>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  );
}
