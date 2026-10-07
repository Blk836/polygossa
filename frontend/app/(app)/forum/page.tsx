"use client";

import { Named } from "@/components/avatar";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Badge, Empty, ErrorNote, LinkButton, PageHeader, Pager, Spinner } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import {
  FORUM_CATEGORIES,
  categoryFromParam,
  forumCategoryLabel,
  forumListPath,
  forumPageHref,
  pageCount,
  type ForumCategory,
  type ThreadList,
  type ThreadSummary,
} from "@/lib/forum";

const tabClass = (current: boolean) =>
  `whitespace-nowrap rounded-md px-3 py-1.5 ${current ? "bg-accent-soft font-medium" : "text-muted hover:text-ink"}`;

/** The forum: threads by category, pinned first, then by latest post. */
export default function ForumPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ForumView />
    </Suspense>
  );
}

function ForumView() {
  const params = useSearchParams();
  const router = useRouter();
  const category = categoryFromParam(params.get("category"));
  const page = Math.max(0, Number(params.get("page")) || 0);
  const [list, setList] = useState<ThreadList | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<ThreadList>(forumListPath(category, page))
      .then((l) => !cancelled && setList(l))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [category, page]);

  const newHref = category && category !== "announcements" ? `/forum/new?category=${category}` : "/forum/new";
  return (
    <div>
      <PageHeader
        title="Forum"
        subtitle="Report bugs, share ideas and talk with other learners and the team"
        actions={<LinkButton href={newHref}>New thread</LinkButton>}
      />
      <nav aria-label="Forum categories" data-tour="forum-categories" className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-line bg-card p-1 text-sm sm:w-fit">
        <Link href={forumPageHref(null, 0)} aria-current={category === null ? "page" : undefined} className={tabClass(category === null)}>All</Link>
        {FORUM_CATEGORIES.map((c) => (
          <Link key={c.code} href={forumPageHref(c.code, 0)} aria-current={category === c.code ? "page" : undefined} className={tabClass(category === c.code)}>
            {c.label}
          </Link>
        ))}
      </nav>
      <ErrorNote message={error} />
      {list ? (
        <Threads list={list} showCategory={category === null} page={page} onPage={(p) => router.push(forumPageHref(category, p))} />
      ) : (
        !error && <Spinner />
      )}
    </div>
  );
}

function Threads({ list, showCategory, page, onPage }: { list: ThreadList; showCategory: boolean; page: number; onPage: (page: number) => void }) {
  if (list.threads.length === 0) return <Empty title="No threads yet">Start the first one.</Empty>;
  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
        {list.threads.map((t) => <ThreadRow key={t.id} thread={t} showCategory={showCategory} />)}
      </ul>
      <Pager page={page} pages={pageCount(list.total, list.size)} onPage={onPage} />
    </>
  );
}

function ThreadRow({ thread, showCategory }: { thread: ThreadSummary; showCategory: boolean }) {
  return (
    <li data-testid="forum-thread">
      <Link href={`/forum/${thread.id}`} className="flex flex-col gap-1 p-4 hover:bg-paper sm:flex-row sm:items-center sm:justify-between">
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            {thread.pinned && <Badge>Pinned</Badge>}
            {thread.category === "announcements" && <Badge>Announcement</Badge>}
            {thread.locked && <Badge>Locked</Badge>}
            <span className="font-medium break-words">{thread.title}</span>
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            {showCategory && thread.category !== "announcements" && `${forumCategoryLabel(thread.category as ForumCategory)} · `}
            <Named name={thread.author.name} photoUrl={thread.author.photoUrl} />
          </span>
        </span>
        <span className="shrink-0 text-xs text-muted">
          {thread.replies} {thread.replies === 1 ? "reply" : "replies"} · {new Date(thread.lastPostAt).toLocaleDateString()}
        </span>
      </Link>
    </li>
  );
}
