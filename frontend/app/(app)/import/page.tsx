"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useMe } from "@/components/me-context";
import { Button, FailureNote, Field, PageHeader, inputClass, selectClass } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { LANGUAGES } from "@/lib/languages";
import type { TextSummary } from "@/lib/types";

type Mode = "paste" | "url" | "subtitles" | "youtube";

const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: "paste", label: "Paste text", hint: "Articles, book chapters, lyrics — anything you can copy." },
  { id: "url", label: "From a URL", hint: "We fetch the page and pull out the article text." },
  { id: "subtitles", label: "Subtitles", hint: "Upload an .srt or .vtt file; timings are kept for audio sync." },
  {
    id: "youtube",
    label: "YouTube video",
    hint: "Paste a YouTube link. We use the video’s captions in the language you pick, and the transcript follows along as it plays.",
  },
];

interface Draft {
  title: string;
  language: string;
  content: string;
  url: string;
  file: File | null;
  transcript: string;
  isPublic: boolean;
}

/** A YouTube import: captions are fetched unless the user supplies a subtitle file or a transcript. */
function submitYouTube(d: Draft): Promise<TextSummary> {
  const form = new FormData();
  form.append("url", d.url);
  form.append("language", d.language);
  form.append("isPublic", String(d.isPublic));
  if (d.title) form.append("title", d.title);
  if (d.file) form.append("file", d.file);
  else if (d.transcript.trim()) form.append("transcript", d.transcript);
  return api("texts/import-youtube", { body: form });
}

/** Creates the text or video from whichever source the user picked. */
function submitImport(mode: Mode, d: Draft): Promise<TextSummary> {
  if (mode === "youtube") return submitYouTube(d);
  if (mode === "paste") {
    return api("texts", { body: { title: d.title, language: d.language, content: d.content, isPublic: d.isPublic } });
  }
  if (mode === "url") {
    return api("texts/import-url", { body: { url: d.url, language: d.language, title: d.title || undefined, isPublic: d.isPublic } });
  }
  if (!d.file) return Promise.reject(new Error("Choose a subtitle file"));
  const form = new FormData();
  form.append("file", d.file);
  form.append("language", d.language);
  form.append("isPublic", String(d.isPublic));
  if (d.title) form.append("title", d.title);
  return api("texts/import-subtitles", { body: form });
}

const fileInputClass = "block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:px-3 file:py-1.5";

function YouTubeInput({ draft, update }: { draft: Draft; update: (patch: Partial<Draft>) => void }) {
  return (
    <>
      <Field label="YouTube link">
        <input className={inputClass} type="url" required value={draft.url} onChange={(e) => update({ url: e.target.value })}
          placeholder="https://www.youtube.com/watch?v=…" />
      </Field>
      <details className="rounded-lg border border-line bg-card p-3 text-sm">
        <summary className="cursor-pointer text-muted">No captions in this language? Add your own transcript</summary>
        <div className="mt-3 space-y-4">
          <Field label="Subtitle file (.srt or .vtt)" hint="Keeps exact timings; used instead of YouTube’s captions.">
            <input type="file" accept=".srt,.vtt,text/vtt" onChange={(e) => update({ file: e.target.files?.[0] ?? null })} className={fileInputClass} />
          </Field>
          <Field label="Or paste the transcript" hint="Timings are estimated from the video’s length.">
            <textarea className={`${inputClass} min-h-32 font-reading`} value={draft.transcript} maxLength={100_000}
              onChange={(e) => update({ transcript: e.target.value })} disabled={!!draft.file} />
          </Field>
        </div>
      </details>
    </>
  );
}

function SourceInput({ mode, draft, update }: { mode: Mode; draft: Draft; update: (patch: Partial<Draft>) => void }) {
  if (mode === "youtube") return <YouTubeInput draft={draft} update={update} />;
  if (mode === "paste") {
    return (
      <Field label="Text">
        <textarea className={`${inputClass} min-h-72 font-reading text-base leading-relaxed`} value={draft.content}
          onChange={(e) => update({ content: e.target.value })} required maxLength={100_000} placeholder="Paste your text here…" />
      </Field>
    );
  }
  if (mode === "url") {
    return (
      <Field label="Web address">
        <input className={inputClass} type="url" required value={draft.url} onChange={(e) => update({ url: e.target.value })} placeholder="https://…" />
      </Field>
    );
  }
  return (
    <Field label="Subtitle file">
      <input type="file" accept=".srt,.vtt,text/vtt" required onChange={(e) => update({ file: e.target.files?.[0] ?? null })} className={fileInputClass} />
    </Field>
  );
}

function ImportForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { me, refresh } = useMe();
  const [mode, setMode] = useState<Mode>(params.get("mode") === "youtube" ? "youtube" : "paste");
  const [draft, setDraft] = useState<Draft>({
    title: "",
    language: params.get("language") ?? me.targetLanguage ?? "es",
    content: "",
    url: "",
    file: null,
    transcript: "",
    isPublic: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const created = await submitImport(mode, draft);
      void refresh();
      router.push(`/read/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-card p-1 text-sm sm:grid-cols-4">
        {MODES.map((m) => (
          <button type="button" key={m.id} onClick={() => setMode(m.id)}
            className={`rounded-md px-3 py-1.5 ${mode === m.id ? "bg-accent-soft font-medium" : "text-muted"}`}>
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">{MODES.find((m) => m.id === mode)?.hint}</p>

      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label={mode === "paste" ? "Title" : "Title (optional)"}>
          <input className={inputClass} value={draft.title} onChange={(e) => update({ title: e.target.value })} required={mode === "paste"} maxLength={250} />
        </Field>
        <Field label="Language">
          <select className={selectClass} value={draft.language} onChange={(e) => update({ language: e.target.value })}>
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </Field>
      </div>
      <SourceInput mode={mode} draft={draft} update={update} />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={draft.isPublic} onChange={(e) => update({ isPublic: e.target.checked })} />
        Share in the community library (only if you have the right to share it)
      </label>
      <FailureNote error={error} />
      <Button type="submit" disabled={busy}>{busy ? "Importing…" : mode === "youtube" ? "Import and start watching" : "Import and start reading"}</Button>
    </form>
  );
}

export default function ImportPage() {
  return (
    <div>
      <PageHeader title="Import" subtitle="Add a text or a YouTube video to your library." />
      <Suspense>
        <ImportForm />
      </Suspense>
    </div>
  );
}
