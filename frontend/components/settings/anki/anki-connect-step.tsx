"use client";

import { useState, type FormEvent } from "react";
import { Button, inputClass } from "@/components/ui";
import { ANKI_CONNECT_CODE, keyWorks, saveKey, type ConnectResult } from "@/lib/anki-connect";

export type Connection = ConnectResult["kind"] | "idle" | "connecting" | "checking" | "away";

function corsLine(): string {
  return `"webCorsOriginList": ["${typeof window === "undefined" ? "" : window.location.origin}"]`;
}

function Problem({ connection }: { connection: Connection }) {
  if (connection === "unreachable") {
    return (
      <div role="alert" className="rounded-lg bg-paper p-3 text-sm">
        <p className="font-medium">Can&apos;t reach Anki</p>
        <ul className="mt-1 list-disc pl-5 text-muted">
          <li>Is Anki desktop open on this computer?</li>
          <li>Is the AnkiConnect add-on installed (code {ANKI_CONNECT_CODE}), and was Anki restarted after?</li>
          <li>Did Chrome ask to let this site reach devices on your network? If you blocked it, allow it again from the icon at the left of the address bar (site settings).</li>
        </ul>
      </div>
    );
  }
  if (connection === "denied") {
    return (
      <div role="alert" className="rounded-lg bg-paper p-3 text-sm">
        <p className="font-medium">Anki refused the connection</p>
        <p className="mt-1 text-muted">Click Connect again and choose Yes in Anki, or add this line to AnkiConnect&apos;s config (Tools → Add-ons → AnkiConnect → Config):</p>
        <code className="mt-1 block break-all rounded bg-card p-2 text-xs">{corsLine()}</code>
      </div>
    );
  }
  if (connection === "outdated") {
    return <p role="alert" className="text-sm">Your AnkiConnect is too old. In Anki, choose Tools → Add-ons → Check for updates, then restart Anki.</p>;
  }
  return null;
}

function KeyForm({ onConnected }: { onConnected: () => void }) {
  const [key, setKey] = useState("");
  const [wrong, setWrong] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (await keyWorks(key)) {
      saveKey(key);
      onConnected();
    } else setWrong(true);
  }
  return (
    <form onSubmit={submit} className="space-y-2 text-sm">
      <label className="block">
        <span className="font-medium">AnkiConnect asks for its API key</span>
        <input className={inputClass} value={key} onChange={(e) => setKey(e.target.value)} aria-label="AnkiConnect API key" type="password" />
      </label>
      {wrong && <p role="alert" className="text-danger">That key isn&apos;t right.</p>}
      <p className="text-xs text-muted">It stays in this browser and is never sent to us.</p>
      <Button type="submit" variant="secondary">Use this key</Button>
    </form>
  );
}

export function AnkiConnectStep({ connection, accountConnected, onConnect, onConnected }: {
  connection: Connection;
  accountConnected: boolean;
  onConnect: () => void;
  onConnected: () => void;
}) {
  if (connection === "granted") return <p className="text-sm font-medium text-good" role="status">Connected to Anki</p>;
  if (connection === "checking") return <p className="text-sm text-muted" role="status">Checking Anki…</p>;
  const label = accountConnected ? "Reconnect to Anki" : "Connect to Anki";
  return (
    <div className="space-y-3">
      {accountConnected && <p className="text-sm font-medium">Your account is connected to Anki, but this browser can&apos;t reach it right now.</p>}
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>Install Anki desktop on this computer (it&apos;s free).</li>
        <li>In Anki, choose Tools → Add-ons → Get Add-ons and enter <strong>{ANKI_CONNECT_CODE}</strong> (AnkiConnect).</li>
        <li>Restart Anki, and keep it open while you use this site.</li>
      </ol>
      <p className="text-xs text-muted">Syncing needs Anki desktop on a computer. Reviews on your phone count once Anki desktop has synced them.</p>
      {connection === "needs-key" ? <KeyForm onConnected={onConnected} /> : (
        <Button onClick={onConnect} disabled={connection === "connecting"}>{connection === "connecting" ? "Connecting…" : label}</Button>
      )}
      <Problem connection={connection} />
    </div>
  );
}
