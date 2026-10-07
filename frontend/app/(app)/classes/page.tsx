"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useMe } from "@/components/me-context";
import { Button, Empty, FailureNote, PageHeader, Spinner, inputClass, selectClass } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { languageName, LEARNING_LANGUAGES } from "@/lib/languages";
import type { ClassSummary, LanguageCode } from "@/lib/types";

type Failure = ApiError | string | null;

function JoinForm({ onJoined, onError }: { onJoined: (c: ClassSummary) => void; onError: (e: Failure) => void }) {
  const [code, setCode] = useState("");
  async function join(e: FormEvent) {
    e.preventDefault();
    onError(null);
    try {
      onJoined(await api<ClassSummary>("classes/join", { body: { code } }));
      setCode("");
    } catch (err) {
      onError(err instanceof ApiError ? err : errorMessage(err));
    }
  }
  return (
    <form onSubmit={join} className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">Join a class</h2>
      <div className="mt-3 flex gap-2">
        <input className={`${inputClass} uppercase tracking-widest`} placeholder="CODE" value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} required aria-label="Class code" />
        <Button type="submit">Join</Button>
      </div>
    </form>
  );
}

function CreateForm({ canTeach, defaultLanguage, onCreated, onError }: {
  canTeach: boolean;
  defaultLanguage: LanguageCode;
  onCreated: (c: ClassSummary) => void;
  onError: (e: Failure) => void;
}) {
  const [name, setName] = useState("");
  const [language, setLanguage] = useState<LanguageCode>(defaultLanguage);
  async function create(e: FormEvent) {
    e.preventDefault();
    onError(null);
    try {
      onCreated(await api<ClassSummary>("classes", { body: { name, language } }));
      setName("");
    } catch (err) {
      onError(err instanceof ApiError ? err : errorMessage(err));
    }
  }
  return (
    <form onSubmit={create} className="rounded-xl border border-line bg-card p-4">
      <h2 className="font-medium">Create a class</h2>
      {canTeach ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <input className={inputClass} placeholder="Class name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} aria-label="Class name" />
          <select className={selectClass} value={language} onChange={(e) => setLanguage(e.target.value as LanguageCode)} aria-label="Language">
            {LEARNING_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
          <Button type="submit">Create</Button>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted">
          Teachers on the <Link href="/settings/subscription" className="underline">Classroom plan</Link> can create classes, assign texts and see student progress.
        </p>
      )}
    </form>
  );
}

function ClassSection({ label, classes }: { label: string; classes: ClassSummary[] }) {
  if (!classes.length) return null;
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-medium text-muted">{label}</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <Link key={c.id} href={`/classes/${c.id}`} className="rounded-xl border border-line bg-card p-4 hover:border-accent">
            <p className="font-semibold">{c.name}</p>
            <p className="mt-1 text-sm text-muted">
              {languageName(c.language)} · {c.studentCount} students{c.role === "student" && ` · ${c.teacherName}`}
            </p>
            {c.joinCode && <p className="mt-2 font-mono text-sm tracking-widest">{c.joinCode}</p>}
          </Link>
        ))}
      </div>
    </section>
  );
}

function ClassList({ classes, error }: { classes: ClassSummary[] | null; error: Failure }) {
  if (!classes) return error ? null : <div className="mt-6"><Spinner /></div>;
  if (!classes.length) return <div className="mt-6"><Empty title="You're not in any classes yet" /></div>;
  return (
    <>
      <ClassSection label="Teaching" classes={classes.filter((c) => c.role === "teacher")} />
      <ClassSection label="Enrolled" classes={classes.filter((c) => c.role === "student")} />
    </>
  );
}

export default function ClassesPage() {
  const { me, refresh } = useMe();
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [error, setError] = useState<Failure>(null);

  useEffect(() => {
    api<ClassSummary[]>("classes").then(setClasses).catch((e) => setError(errorMessage(e)));
  }, []);

  function joined(c: ClassSummary) {
    setClasses((list) => [...(list ?? []).filter((x) => x.id !== c.id), c]);
    void refresh(); // joining a Classroom-plan class unlocks Pro
  }

  return (
    <div>
      <PageHeader title="Classes" subtitle="Join your teacher's class, or run your own on the Classroom plan." />
      <FailureNote error={error} />
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <JoinForm onJoined={joined} onError={setError} />
        <CreateForm
          canTeach={me.plan.tier === "CLASSROOM"}
          defaultLanguage={me.targetLanguage ?? "es"}
          onCreated={(c) => setClasses((list) => [c, ...(list ?? [])])}
          onError={setError}
        />
      </div>
      <ClassList classes={classes} error={error} />
    </div>
  );
}
