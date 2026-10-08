"use client";

import { useState, type FormEvent } from "react";
import { useMe } from "../me-context";
import { Button, ErrorNote, Field, inputClass } from "../ui";

/** Settings › Privacy: delete the account and everything in it, confirmed by typing its email (gdpr.feature). */
export function DeleteAccountSection() {
  const { me } = useMe();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = confirm.trim().toLowerCase() === me.email.toLowerCase();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmEmail: confirm }),
      });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { message?: string }).message);
      const cognito = res.status === 200 ? ((await res.json()) as { redirect?: string }).redirect : undefined;
      window.location.assign(cognito ?? "/");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Couldn't delete the account. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form role="group" aria-label="Delete my account" onSubmit={submit} className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Delete my account</h2>
      <p className="mt-0.5 text-sm text-muted">
        Deletes your account and everything in it: your texts (including ones you shared with the community), words,
        reviews, progress, writing, playlists, classes you teach and forum posts. This can&apos;t be undone, so download
        your data first if you want a copy.
      </p>
      <div className="mt-3 space-y-3">
        <Field label="Type your email to confirm">
          <input className={inputClass} type="email" autoComplete="off" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>
        <ErrorNote message={error} />
        <Button type="submit" variant="danger" disabled={!matches || busy}>Delete my account</Button>
      </div>
    </form>
  );
}
