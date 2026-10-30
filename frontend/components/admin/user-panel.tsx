"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, ErrorNote, Spinner, inputClass, selectClass } from "@/components/ui";
import { ACTIONS, actionSummary, tidySummary, type ActionKey, type AdminUserDetail, type TidyReport } from "@/lib/admin";
import { api, errorMessage } from "@/lib/api";
import type { Tier } from "@/lib/types";

function Confirm({ text, yes, onYes, onNo }: { text: string; yes: string; onYes: () => void; onNo: () => void }) {
  return (
    <div role="alertdialog" aria-label="Are you sure?" className="mt-3 rounded-lg border border-line bg-paper p-3 text-sm">
      <p>{text}</p>
      <div className="mt-2 flex gap-2">
        <Button onClick={onYes}>{yes}</Button>
        <Button variant="secondary" onClick={onNo}>Cancel</Button>
      </div>
    </div>
  );
}

interface Tidy {
  busy: number | null;
  onTidy: (id: number) => void;
}

function ItemList({ title, items, onRemove, tidy }: { title: string; items: AdminUserDetail["texts"]; onRemove?: (id: number) => void; tidy?: Tidy }) {
  return (
    <div>
      <h3 className="text-sm font-medium">{title} ({items.length})</h3>
      <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2">
            {i.kind === "playlist" ? <span className="min-w-0 flex-1 truncate">{i.title}</span>
              : <Link href={`/read/${i.id}`} className="min-w-0 flex-1 truncate underline">{i.title}</Link>}
            <span className="text-xs text-muted">{i.isPublic ? "shared" : "private"}{i.kind === "video" ? " · video" : ""}</span>
            {tidy && i.kind === "video" && (
              <button type="button" className="text-xs underline disabled:opacity-60" disabled={tidy.busy === i.id} onClick={() => tidy.onTidy(i.id)}>
                {tidy.busy === i.id ? "Tidying…" : "Tidy transcript"}
              </button>
            )}
            {onRemove && <button type="button" className="text-xs text-danger underline" onClick={() => onRemove(i.id)}>Remove</button>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Summary({ detail }: { detail: AdminUserDetail }) {
  const u = detail.user;
  return (
    <>
      <h2 className="font-display text-lg font-semibold">{u.displayName}</h2>
      <p className="text-sm text-muted">{u.email} · joined {u.createdAt.slice(0, 10)} · last active {u.lastActive ?? "never"}{u.admin && " · admin"}</p>
      <p data-testid="admin-status" className={`mt-2 text-sm font-medium ${u.suspended ? "text-danger" : "text-good"}`}>
        {u.suspended ? `Suspended: ${detail.suspendedReason}` : "Active"}
      </p>
      <p className="mt-1 text-sm">{u.texts} texts · {u.playlists} playlists · {u.posts} forum posts</p>
    </>
  );
}

function actionKeys(detail: AdminUserDetail): ActionKey[] {
  const u = detail.user;
  const first: ActionKey[] = u.suspended ? ["unsuspend"] : u.admin ? [] : ["suspend"];
  return [...first, "unshare", "posts", "playlists", "texts"];
}

export function UserPanel({ id, onChanged }: { id: number; onChanged: () => void }) {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<ActionKey | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reload, setReload] = useState(0);
  const [tidying, setTidying] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<AdminUserDetail>(`admin/users/${id}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  async function run(key: ActionKey) {
    setAsking(null);
    setError(null);
    try {
      const a = ACTIONS[key];
      const result = await api<Record<string, number>>(a.path(id), { method: a.method, body: key === "suspend" ? { reason } : undefined });
      setDone(actionSummary(key, result ?? {}));
      setReload((r) => r + 1);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function act(path: string, body: Record<string, unknown> | undefined, method: "POST" | "DELETE", summary: string) {
    setError(null);
    try {
      await api(path, { method, body });
      setDone(summary);
      setReload((r) => r + 1);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  async function tidy(textId: number) {
    setDone(null);
    setError(null);
    setTidying(textId);
    try {
      setDone(tidySummary(await api<TidyReport>(`admin/texts/${textId}/tidy-transcript`, { method: "POST", body: {} })));
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setTidying(null);
    }
  }

  if (!detail) return error ? <ErrorNote message={error} /> : <Spinner />;
  const u = detail.user;
  return (
    <section aria-label={`User ${u.email}`} className="rounded-xl border border-line bg-card p-5">
      <Summary detail={detail} />

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Plan{" "}
          <select aria-label="Plan" className={selectClass} value={u.plan}
            onChange={(e) => void act(`admin/users/${id}/plan`, { tier: e.target.value as Tier }, "POST", `Plan changed to ${e.target.value}`)}>
            <option value="FREE">Free</option>
            <option value="PRO">Pro</option>
            <option value="CLASSROOM">Classroom</option>
          </select>
        </label>
        {!u.suspended && !u.admin && (
          <label className="text-sm">
            Reason <input className={inputClass} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. spam" />
          </label>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {actionKeys(detail).map((k) => (
          <Button key={k} variant={ACTIONS[k].danger ? "danger" : "secondary"} onClick={() => { setDone(null); setAsking(k); }}>
            {ACTIONS[k].label}
          </Button>
        ))}
      </div>
      {asking && <Confirm text={ACTIONS[asking].confirm(u.email)} yes={ACTIONS[asking].yes} onYes={() => void run(asking)} onNo={() => setAsking(null)} />}
      {done && <p role="status" className="mt-2 text-sm text-good">{done}</p>}
      <ErrorNote message={error} />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <ItemList title="Texts and videos" items={detail.texts}
          onRemove={(textId) => void act(`admin/texts/${textId}`, undefined, "DELETE", "Removed the text")}
          tidy={{ busy: tidying, onTidy: (textId) => void tidy(textId) }} />
        <ItemList title="Playlists" items={detail.playlists} />
      </div>
    </section>
  );
}
