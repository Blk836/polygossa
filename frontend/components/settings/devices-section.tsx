"use client";

import { useState } from "react";
import { Button, ErrorNote } from "../ui";

/** Settings › Profile: sign out on every device at once (cognito-login.feature, "Signing out everywhere"). */
export function DevicesSection() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOutEverywhere() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/sign-out-everywhere", { method: "POST" });
      if (!res.ok && res.status !== 401) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message);
      // A Cognito session also signs out at Cognito, whose page comes back to the landing page.
      const cognito = res.status === 200 ? ((await res.json()) as { redirect?: string }).redirect : undefined;
      window.location.assign(cognito ?? "/");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't sign out everywhere. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div role="group" aria-label="Signed-in devices" className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Signed-in devices</h2>
      <p className="mt-0.5 text-sm text-muted">
        Lost a phone or signed in on a shared computer? Sign out on every device, this one included.
      </p>
      <ErrorNote message={error} />
      <div className="mt-3">
        <Button variant="secondary" disabled={busy} onClick={() => void signOutEverywhere()}>Sign out everywhere</Button>
      </div>
    </div>
  );
}
