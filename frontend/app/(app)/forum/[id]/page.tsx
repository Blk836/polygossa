"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { PostItem } from "@/components/forum/post-item";
import { Badge, Button, Empty, ErrorNote, LinkButton, Pager, Spinner, inputClass } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { forumCategoryLabel, forumPageHref, pageCount, threadPath, type ForumPost, type ThreadPage, type ThreadSummary } from "@/lib/forum";

/** One forum thread: its posts, oldest first, 50 a page, a reply box unless locked, and admins' pin and lock. */
export default function ThreadView() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<ThreadPage | null>(null);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<ThreadPage>(threadPath(Number(id), page))
      .then((d) => !cancelled && setData(d))
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setMissing(true);
        else setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id, page, reload]);

  if (missing) {
    return (
      <Empty title="Thread not found">
        It may have been deleted. <LinkButton href="/forum" variant="secondary" className="mt-3">Back to the forum</LinkButton>
      </Empty>
    );
  }
  if (!data) return error ? <ErrorNote message={error} /> : <Spinner />;
  const { thread } = data;

  async function moderate(change: Partial<Pick<ThreadSummary, "pinned" | "locked">>) {
    setError(null);
    try {
      const updated = await api<ThreadSummary>(`forum/threads/${thread.id}`, { method: "PATCH", body: change });
      setData((d) => d && { ...d, thread: updated });
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  const replaced = (post: ForumPost) => setData((d) => d && { ...d, posts: d.posts.map((p) => (p.id === post.id ? post : p)) });
  const deleted = (post: ForumPost, first: boolean) => (first ? router.push(forumPageHref(null, 0)) : setReload((r) => r + 1));

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-muted">
        <Link href="/forum" className="underline">Forum</Link> › <Link href={forumPageHref(thread.category, 0)} className="underline">{forumCategoryLabel(thread.category)}</Link>
      </p>
      <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold break-words">
        {thread.pinned && <Badge>Pinned</Badge>}
        {thread.title}
      </h1>
      {data.canModerate && (
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={() => void moderate({ pinned: !thread.pinned })}>{thread.pinned ? "Unpin" : "Pin"}</Button>
          <Button variant="secondary" onClick={() => void moderate({ locked: !thread.locked })}>{thread.locked ? "Unlock" : "Lock"}</Button>
        </div>
      )}
      <ErrorNote message={error} />
      <ul className="mt-4 divide-y divide-line rounded-xl border border-line bg-card">
        {data.posts.map((p, i) => {
          const first = page === 0 && i === 0;
          return (
            <PostItem key={p.id} post={p} first={first} canDelete={p.mine || data.canModerate}
              onChanged={replaced} onDeleted={() => deleted(p, first)} />
          );
        })}
      </ul>
      <Pager page={page} pages={pageCount(data.total, data.size)} onPage={setPage} />
      {thread.locked ? (
        <p className="mt-6 rounded-xl border border-line bg-card p-4 text-sm text-muted">Locked: no new replies</p>
      ) : (
        <ReplyBox threadId={thread.id} onPosted={() => {
          const last = pageCount(data.total + 1, data.size) - 1;
          if (last === page) setReload((r) => r + 1);
          else setPage(last);
        }} />
      )}
    </div>
  );
}

function ReplyBox({ threadId, onPosted }: { threadId: number; onPosted: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`forum/threads/${threadId}/posts`, { body: { body } });
      setBody("");
      onPosted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-2">
      <textarea aria-label="Your reply" placeholder="Write a reply" className={`${inputClass} min-h-28`} value={body}
        onChange={(e) => setBody(e.target.value)} required maxLength={10000} />
      <ErrorNote message={error} />
      <Button type="submit" disabled={busy}>Reply</Button>
    </form>
  );
}
