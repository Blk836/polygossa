"use client";

import { useEffect, useState } from "react";
import { StatsPanel } from "@/components/admin/stats-panel";
import { UserPanel } from "@/components/admin/user-panel";
import { Button, ErrorNote, PageHeader, Pager, Spinner, inputClass } from "@/components/ui";
import { usersPath, type AdminActionRow, type AdminStats, type AdminUserPage } from "@/lib/admin";
import { api, errorMessage } from "@/lib/api";

/** Loads a GET endpoint again whenever `key` changes; the last good value stays while reloading. */
function useAdmin<T>(path: string, key: number): { data: T | null; error: string | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<T>(path)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError(null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [path, key]);
  return { data, error };
}

function UserTable({ page, onOpen }: { page: AdminUserPage; onOpen: (id: number) => void }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead className="text-xs text-muted">
          <tr><th className="py-1 pr-3">User</th><th className="pr-3">Plan</th><th className="pr-3">Joined</th><th className="pr-3">Last active</th><th className="pr-3">Content</th><th /></tr>
        </thead>
        <tbody>
          {page.items.map((u) => (
            <tr key={u.id} className="border-t border-line">
              <td className="py-2 pr-3">
                <div className="font-medium">{u.displayName}{u.admin && <span className="ml-1 text-xs text-muted">admin</span>}{u.suspended && <span className="ml-1 text-xs text-danger">suspended</span>}</div>
                <div className="text-xs text-muted">{u.email}</div>
              </td>
              <td className="pr-3">{u.plan.toLowerCase()}</td>
              <td className="pr-3 tabular-nums">{u.createdAt.slice(0, 10)}</td>
              <td className="pr-3 tabular-nums">{u.lastActive ?? "—"}</td>
              <td className="pr-3 tabular-nums">{u.texts} texts · {u.playlists} lists · {u.posts} posts</td>
              <td><Button variant="secondary" onClick={() => onOpen(u.id)}>Open</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Actions({ rows }: { rows: AdminActionRow[] }) {
  return (
    <section aria-label="Recent actions" className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-display text-lg font-semibold">Recent actions</h2>
      {rows.length === 0 ? <p className="mt-2 text-sm text-muted">Nothing yet.</p> : (
        <ul className="mt-2 space-y-1 text-sm">
          {rows.slice(0, 20).map((a, i) => (
            <li key={i}><span className="tabular-nums text-muted">{a.at.slice(0, 16).replace("T", " ")}</span> · {a.admin}: <strong>{a.action}</strong> {a.target}{a.detail && ` (${a.detail})`}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The team's panel: how the product is doing, and moderation of accounts. Admins only (the API answers 403 otherwise). */
export default function AdminPage() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState({ q: "", page: 0 });
  const [open, setOpen] = useState<number | null>(null);
  const [changes, setChanges] = useState(0);
  const stats = useAdmin<AdminStats>("admin/stats", changes);
  const users = useAdmin<AdminUserPage>(usersPath(search.q, search.page), changes);
  const actions = useAdmin<AdminActionRow[]>("admin/actions", changes);

  if (stats.error && !stats.data) return <ErrorNote message={stats.error} />;
  if (!stats.data) return <Spinner />;
  return (
    <div className="space-y-6">
      <PageHeader title="Admin" subtitle="How the product is doing, and keeping it a good place" />
      <StatsPanel stats={stats.data} />

      <section aria-label="Users" className="rounded-xl border border-line bg-card p-5">
        <h2 className="font-display text-lg font-semibold">Users</h2>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); setSearch({ q: query, page: 0 }); }}>
          <input className={inputClass} placeholder="Search by email or name" value={query} onChange={(e) => setQuery(e.target.value)} />
          <Button type="submit">Search</Button>
        </form>
        <ErrorNote message={users.error} />
        {users.data && (
          <>
            <p className="mt-3 text-sm text-muted">{users.data.total.toLocaleString("en-US")} users</p>
            <UserTable page={users.data} onOpen={setOpen} />
            <Pager page={search.page} pages={Math.ceil(users.data.total / users.data.size)} onPage={(page) => setSearch((s) => ({ ...s, page }))} />
          </>
        )}
      </section>

      {open !== null && <UserPanel key={open} id={open} onChanged={() => setChanges((c) => c + 1)} />}
      {actions.data && <Actions rows={actions.data} />}
    </div>
  );
}
