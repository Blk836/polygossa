"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CardLayoutPicker } from "@/components/card-layout-picker";
import { useCardLayout } from "@/components/card-layout-context";
import { useMe } from "@/components/me-context";
import { PlaylistCard } from "@/components/playlists/playlist-card";
import { loadPlaylists, saveable } from "@/components/playlists/playlist-shelf";
import { Button, Empty, ErrorNote, PageHeader, Spinner, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { cardGridClass } from "@/lib/card-layout";
import { languageName, LEARNING_LANGUAGES } from "@/lib/languages";
import type { PlaylistSummary } from "@/lib/playlist-types";
import type { LanguageCode } from "@/lib/types";

export default function PlaylistsPage() {
  const { me } = useMe();
  return <Playlists key={me.targetLanguage ?? "all"} language={me.targetLanguage ?? ""} />;
}

function Playlists({ language }: { language: string }) {
  const { layout } = useCardLayout();
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPlaylists("yours", language)
      .then((l) => !cancelled && setLists(l))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [language]);

  const name = language ? languageName(language) + " " : "";
  return (
    <div>
      <PageHeader title="Playlists" subtitle={`${name ? name + "playlists" : "Playlists"} you made or saved. Group texts and videos to read in order, and share them with other learners.`} actions={<CardLayoutPicker />} />
      <CreateForm language={language} onCreated={(p) => setLists((l) => [p, ...(l ?? [])])} />
      <ErrorNote message={error} />
      {!lists && !error && <Spinner />}
      {lists?.length === 0 && (
        <Empty title={`No ${name}playlists yet`}>Create one above, use the playlist button on any text or video, or save one you find in Explore.</Empty>
      )}
      <div className={cardGridClass(layout)} data-testid="playlist-grid">
        {lists?.map((p) => <PlaylistCard key={p.id} playlist={p} layout={layout} saveable={saveable(p)} />)}
      </div>
    </div>
  );
}

function CreateForm({ language, onCreated }: { language: string; onCreated: (p: PlaylistSummary) => void }) {
  const [title, setTitle] = useState("");
  const [lang, setLang] = useState<LanguageCode>((language || "es") as LanguageCode);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      onCreated(await api<PlaylistSummary>("playlists", { body: { title: title.trim(), language: lang } }));
      setTitle("");
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} data-tour="playlist-create" className="mb-6 flex flex-col gap-2 rounded-xl border border-line bg-card p-3 sm:flex-row">
      <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New playlist name…" aria-label="Playlist name" maxLength={120} />
      {!language && (
        <select className={`${selectClass} sm:w-40`} value={lang} onChange={(e) => setLang(e.target.value as LanguageCode)} aria-label="Language">
          {LEARNING_LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
        </select>
      )}
      <Button type="submit" disabled={!title.trim()} className="shrink-0">Create playlist</Button>
      {error && <div className="sm:basis-full"><ErrorNote message={error} /></div>}
    </form>
  );
}
