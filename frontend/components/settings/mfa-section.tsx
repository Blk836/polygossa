"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button, ErrorNote, Field, inputClass } from "../ui";

interface Status {
  on: boolean;
  federated: boolean;
}

interface Setup {
  secret: string;
  uri: string;
}

async function call<T>(method: string, body?: object): Promise<T> {
  const res = await fetch("/api/auth/mfa", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new Error(data.message ?? "Something went wrong. Try again.");
  return data;
}

/** The secret in groups of four, easier to type into an app by hand. */
const grouped = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

/**
 * Settings › Profile: a second step at sign-in with an authenticator app (cognito-login.feature). Shown only for
 * accounts that sign in through Cognito; Google accounts use Google's own two-step verification.
 */
export function MfaSection() {
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/mfa")
      .then((res) => (res.ok ? (res.json() as Promise<Status>) : null))
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!status) return null;

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const start = () => run(async () => setSetup(await call<Setup>("POST", { action: "start" })));
  const turnOff = () => run(async () => setStatus(await call<Status>("DELETE")));
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      setStatus(await call<Status>("POST", { action: "confirm", code }));
      setSetup(null);
      setCode("");
    });
  };

  return (
    <div role="group" aria-label="Two-step sign-in" className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Two-step sign-in</h2>
      <p className="mt-0.5 text-sm text-muted">
        {status.federated
          ? "You sign in with Google: turn on two-step verification in your Google account."
          : status.on
            ? "On: signing in asks for a code from your authenticator app."
            : "Ask for a code from an authenticator app (such as Google Authenticator or 1Password) when you sign in."}
      </p>
      <ErrorNote message={error} />
      {!status.federated && !setup && (
        <div className="mt-3">
          {status.on
            ? <Button variant="secondary" onClick={() => void turnOff()}>Turn off</Button>
            : <Button variant="secondary" onClick={() => void start()}>Set up an authenticator app</Button>}
        </div>
      )}
      {setup && (
        <form onSubmit={confirm} className="mt-3 space-y-3">
          <p className="text-sm">
            In your app, add an account with this key (or <a href={setup.uri} className="underline">open the app</a> on
            this phone):
          </p>
          <p data-testid="mfa-secret" className="select-all rounded-lg bg-paper px-3 py-2 font-mono text-sm tracking-wider">
            {grouped(setup.secret)}
          </p>
          <Field label="Code from the app">
            <input
              className={inputClass}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            />
          </Field>
          <div className="flex gap-2">
            <Button type="submit" disabled={code.length !== 6}>Turn on</Button>
            <Button type="button" variant="ghost" onClick={() => setSetup(null)}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}
