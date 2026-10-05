"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { onboardingPath } from "@/lib/landing";
import { Button, ErrorNote, Field, inputClass } from "./ui";

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`auth/${mode}`, {
        body: mode === "signup" ? { email, password, displayName } : { email, password },
      });
      const next = params.get("next");
      // New accounts go straight to onboarding: pick a language (or keep the one picked on the landing page) and read.
      router.replace(mode === "signup" ? onboardingPath(params.get("lang")) : next && next.startsWith("/") ? next : "/library");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {mode === "signup" && (
        <Field label="Name">
          <input className={inputClass} value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" />
        </Field>
      )}
      <Field label="Email">
        <input className={inputClass} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </Field>
      <Field label="Password" hint={mode === "signup" ? "At least 8 characters" : undefined}>
        <input
          className={inputClass}
          type="password"
          required
          minLength={mode === "signup" ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
        />
      </Field>
      <ErrorNote message={error} />
      <Button type="submit" disabled={busy} className="w-full py-2.5">
        {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-muted">
        {mode === "signup" ? (
          <>Already have an account? <Link href="/login" className="text-accent underline">Sign in</Link></>
        ) : (
          <>New here? <Link href="/signup" className="text-accent underline">Create an account</Link></>
        )}
      </p>
    </form>
  );
}
