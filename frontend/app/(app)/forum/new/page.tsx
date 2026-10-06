"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Button, ErrorNote, Field, PageHeader, Spinner, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { categoryFromParam, forumListPath, postableCategories, type ForumCategory, type ThreadList, type ThreadSummary } from "@/lib/forum";

/** Starting a thread: a category, a title and the first message. */
export default function NewThreadPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <NewThreadForm />
    </Suspense>
  );
}

function NewThreadForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [canModerate, setCanModerate] = useState(false);
  const [category, setCategory] = useState<ForumCategory>(categoryFromParam(params.get("category")) ?? "general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether announcements can be offered comes with any thread list.
  useEffect(() => {
    let cancelled = false;
    api<ThreadList>(forumListPath("announcements", 0))
      .then((l) => !cancelled && setCanModerate(l.canModerate))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const thread = await api<ThreadSummary>("forum/threads", { body: { category, title, body } });
      router.push(`/forum/${thread.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="New thread" />
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-line bg-card p-5">
        <Field label="Category">
          <select className={selectClass} value={category} onChange={(e) => setCategory(e.target.value as ForumCategory)}>
            {postableCategories(canModerate).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={120} />
        </Field>
        <Field label="Message" hint="Plain text. For a bug, say what you did, what you expected and what happened.">
          <textarea className={`${inputClass} min-h-40`} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={10000} />
        </Field>
        <ErrorNote message={error} />
        <Button type="submit" disabled={busy}>Post</Button>
      </form>
    </div>
  );
}
