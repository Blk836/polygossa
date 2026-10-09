"use client";

import { Named } from "@/components/avatar";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useMe } from "@/components/me-context";
import { Badge, Button, Empty, ErrorNote, Field, LevelBadge, PageHeader, Spinner, formatDuration, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { languageName } from "@/lib/languages";
import type { ClassDetail, ClassProgress, TextSummary } from "@/lib/types";

function AssignForm({ detail, onAssigned }: { detail: ClassDetail; onAssigned: () => void }) {
  const [texts, setTexts] = useState<TextSummary[]>([]);
  const [textId, setTextId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<TextSummary[]>("texts"),
      api<{ items: TextSummary[] }>(`library?language=${detail.info.language}&size=50`),
    ]).then(([mine, shared]) => {
      const all = [...mine.filter((t) => t.language === detail.info.language), ...shared.items.filter((t) => !t.mine)];
      setTexts(all);
    }).catch((e) => setError(errorMessage(e)));
  }, [detail.info.language]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`classes/${detail.info.id}/assignments`, { body: { textId: Number(textId), dueDate: dueDate || undefined, note } });
      setTextId("");
      setNote("");
      setDueDate("");
      onAssigned();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-line bg-card p-4">
      <h3 className="font-medium">Assign a text</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px]">
        <Field label="Text">
          <select className={selectClass} value={textId} onChange={(e) => setTextId(e.target.value)} required>
            <option value="">Choose…</option>
            {texts.map((t) => <option key={t.id} value={t.id}>{t.title} ({t.cefrLevel}){t.mine ? "" : " — shared"}</option>)}
          </select>
        </Field>
        <Field label="Due (optional)">
          <input type="date" className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </Field>
      </div>
      <div className="mt-3"><Field label="Note for students (optional)"><input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} /></Field></div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="submit" disabled={!textId}>Assign</Button>
        <Link href={`/import?language=${detail.info.language}`} className="text-sm text-muted underline">Import a new text</Link>
      </div>
      <div className="mt-2"><ErrorNote message={error} /></div>
    </form>
  );
}

function ProgressTable({ classId }: { classId: number }) {
  const [p, setP] = useState<ClassProgress | null>(null);
  useEffect(() => {
    api<ClassProgress>(`classes/${classId}/progress`).then(setP).catch(() => {});
  }, [classId]);
  if (!p) return <Spinner />;
  return (
    <section>
      <div className="mb-3 grid grid-cols-3 gap-3 text-sm">
        <div className="rounded-xl border border-line bg-card p-3"><p className="text-xs text-muted">Avg known words</p><p className="text-xl font-semibold">{p.averageKnownWords}</p></div>
        <div className="rounded-xl border border-line bg-card p-3"><p className="text-xs text-muted">Avg reading time</p><p className="text-xl font-semibold">{p.averageReadingMinutes} min</p></div>
        <div className="rounded-xl border border-line bg-card p-3"><p className="text-xs text-muted">Assignments completed</p><p className="text-xl font-semibold">{p.assignmentCompletionRate}%</p></div>
      </div>
      {p.students.length === 0 ? (
        <Empty title="No students yet">Share the join code with your class.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="p-3 font-medium">Student</th>
                <th className="p-3 text-right font-medium">Known</th>
                <th className="p-3 text-right font-medium">Learning</th>
                <th className="p-3 text-right font-medium">New words 7d / 30d</th>
                <th className="p-3 text-right font-medium">Reading</th>
                <th className="p-3 text-right font-medium">Assignments</th>
                <th className="p-3 text-right font-medium">Last active</th>
              </tr>
            </thead>
            <tbody>
              {p.students.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="p-3 font-medium"><Named name={s.displayName} photoUrl={s.photoUrl} size="sm" /></td>
                  <td className="p-3 text-right tabular-nums">{s.knownWords}</td>
                  <td className="p-3 text-right tabular-nums">{s.learningWords}</td>
                  <td className="p-3 text-right tabular-nums">{s.wordsAdded7d} / {s.wordsAdded30d}</td>
                  <td className="p-3 text-right tabular-nums">{formatDuration(s.readingSeconds)} · {s.sessions}×</td>
                  <td className="p-3 text-right tabular-nums">{s.assignmentsCompleted}/{p.assignmentCount} done</td>
                  <td className="p-3 text-right text-muted">{s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default function ClassPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, refresh } = useMe();
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<ClassDetail>(`classes/${id}`).then(setDetail).catch((e) => setError(errorMessage(e)));
  }, [id]);
  useEffect(load, [load]);

  if (error) return <ErrorNote message={error} />;
  if (!detail) return <Spinner />;
  const teacher = detail.info.role === "teacher";

  async function act(fn: () => Promise<unknown>) {
    try {
      await fn();
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <div>
      <Link href="/classes" className="text-sm text-muted hover:text-ink">← Classes</Link>
      <PageHeader
        title={detail.info.name}
        subtitle={`${languageName(detail.info.language)} · ${teacher ? `${detail.info.studentCount} students` : `taught by ${detail.info.teacherName}`}`}
        actions={
          teacher ? (
            <>
              <span className="rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm tracking-widest" title="Join code">{detail.info.joinCode}</span>
              <Button variant="secondary" onClick={() => act(() => api(`classes/${id}/code`, { method: "POST" }))}>New code</Button>
              <Button variant="danger" onClick={async () => {
                if (!window.confirm("Delete this class? Students keep their own vocabulary.")) return;
                await api(`classes/${id}`, { method: "DELETE" });
                router.push("/classes");
              }}>Delete</Button>
            </>
          ) : (
            <Button variant="danger" onClick={async () => {
              await api(`classes/${id}/members/${me.id}`, { method: "DELETE" });
              void refresh();
              router.push("/classes");
            }}>Leave class</Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 font-medium">Assignments</h2>
          {detail.assignments.length === 0 ? (
            <Empty title="No assignments yet" />
          ) : (
            <ul className="space-y-2">
              {detail.assignments.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card p-3">
                  <LevelBadge level={a.cefrLevel} />
                  <div className="min-w-0 flex-1">
                    <Link href={`/read/${a.textId}`} className="font-medium hover:text-accent">{a.textTitle}</Link>
                    <p className="text-xs text-muted">
                      {a.wordCount} words{a.dueDate && ` · due ${new Date(a.dueDate + "T00:00:00").toLocaleDateString()}`}{a.note && ` · ${a.note}`}
                    </p>
                  </div>
                  {!teacher && (a.completed ? <Badge className="border-good/50 text-good">Done</Badge> : a.opened ? <Badge>Started</Badge> : <Badge>New</Badge>)}
                  {teacher && (
                    <button className="text-sm text-muted hover:text-danger" onClick={() => act(() => api(`classes/${id}/assignments/${a.id}`, { method: "DELETE" }))}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
        {teacher && <AssignForm detail={detail} onAssigned={load} />}
      </div>

      {teacher && (
        <div className="mt-8">
          <h2 className="mb-3 font-medium">Student progress ({languageName(detail.info.language)})</h2>
          <ProgressTable classId={detail.info.id} />
          {detail.students.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2 text-sm">
              {detail.students.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pr-1 pl-1">
                  <Named name={s.displayName} photoUrl={s.photoUrl} size="sm" />
                  <button className="rounded-full px-2 text-muted hover:text-danger" aria-label={`Remove ${s.displayName}`}
                    onClick={() => act(() => api(`classes/${id}/members/${s.id}`, { method: "DELETE" }))}>✕</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
