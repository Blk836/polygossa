"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CardLayoutPicker } from "@/components/card-layout-picker";
import { useCardLayout } from "@/components/card-layout-context";
import { useMe } from "@/components/me-context";
import { PlaylistCard } from "@/components/playlists/playlist-card";
import { Button, Empty, ErrorNote, PageHeader, Spinner, inputClass, selectClass } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { cardGridClass } from "@/lib/card-layout";
import { languageName, LEARNING_LANGUAGES } from "@/lib/languages";
import { withLanguage } from "@/lib/media";
import type { PlaylistSummary } from "@/lib/playlist-types";
import type { LanguageCode } from "@/lib/types";

type Tab = "mine" | "shared";

/** Playlists restart (tab, search) whenever the language in the top bar changes. */
export default function PlaylistsPage() {
  const { me } = useMe();
  return <Playlists key={me.targetLanguage ?? "all"} language={me.targetLanguage ?? ""} />;
}

function Playlists({ language }: { language: string }) {
  const { layout } = useCardLayout();
  const [tab, setTab] = useState<Tab>("mine");
  const [query, setQuery] = useState("");
  const [lists, setLists] = useState<PlaylistSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const q = tab === "shared" && query ? `?q=${encodeURIComponent(query)}` : "";
    api<PlaylistSummary[]>(withLanguage(tab === "mine" ? "playlists" : `playlists/shared${q}`, language))
      .then((l) => !cancelled && setLists(l))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [tab, query, language]);

  const name = language ? languageName(language) + " " : "";
  return (
    <div>
      <PageHeader title="Playlists" subtitle={`Group ${name}texts and videos to read in order, and share the group with other learners.`} actions={<CardLayoutPicker />} />
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabSwitch tab={tab} onChange={(t) => { setTab(t); setLists(null); setError(null); }} />
        {tab === "shared" && <Search onSearch={setQuery} />}
      </div>
      {tab === "mine" && <CreateForm language={language} onCreated={(p) => setLists((l) => [p, ...(l ?? [])])} />}
      <ErrorNote message={error} />
      {!lists && !error && <Spinner />}
      {lists?.length === 0 && <NoPlaylists tab={tab} name={name} searched={!!query} />}
      <div className={cardGridClass(layout)} data-testid="playlist-grid">
        {lists?.map((p) => <PlaylistCard key={p.id} playlist={p} layout={layout} saveable={tab === "shared"} />)}
      </div>
    </div>
  );
}

function NoPlaylists({ tab, name, searched }: { tab: Tab; name: string; searched: boolean }) {
  if (tab === "mine") return <Empty title={`No ${name}playlists yet`}>Create one above, or use the playlist button on any text or video.</Empty>;
  return <Empty title={`No shared ${name}playlists${searched ? " match" : " yet"}`}>Share one of yours from its page.</Empty>;
}

function TabSwitch({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    <div className="flex gap-1 rounded-lg border border-line bg-card p-1 text-sm sm:w-fit" role="group" aria-label="Playlist section">
      {(["mine", "shared"] as const).map((t) => (
        <button key={t} onClick={() => onChange(t)} aria-pressed={tab === t}
          className={`flex-1 whitespace-nowrap rounded-md px-4 py-1.5 ${tab === t ? "bg-accent-soft font-medium" : "text-muted"}`}>
          {t === "mine" ? "My playlists" : "Shared"}
        </button>
      ))}
    </div>
  );
}

function Search({ onSearch }: { onSearch: (q: string) => void }) {
  const [q, setQ] = useState("");
  return (
    <form className="sm:w-80" onSubmit={(e) => { e.preventDefault(); onSearch(q.trim()); }}>
      <input className={inputClass} type="search" placeholder="Search playlists…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search playlists" />
    </form>
  );
}

/** A new playlist in the top bar's language (or a chosen one when the top bar shows every language). */
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
    <form onSubmit={(e) => void submit(e)} className="mb-6 flex flex-col gap-2 rounded-xl border border-line bg-card p-3 sm:flex-row">
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
