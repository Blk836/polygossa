import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { Logo } from "@/components/ui";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-center" aria-label={`${BRAND} home`}><Logo className="text-4xl" /></Link>
      <h1 className="mb-6 text-center font-display text-2xl font-semibold">Welcome back</h1>
      <Suspense>
        <AuthForm mode="login" />
      </Suspense>
    </div>
  );
}
