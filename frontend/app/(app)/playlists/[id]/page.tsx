"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlaylistHeader } from "@/components/playlists/playlist-header";
import { TextCard } from "@/components/text-card";
import { Empty, ErrorNote, LinkButton, Spinner } from "@/components/ui";
import { ApiError, api, errorMessage } from "@/lib/api";
import { moveItem, playlistReadHref } from "@/lib/playlists";
import type { PlaylistDetail } from "@/lib/playlist-types";
import type { TextSummary } from "@/lib/types";

export default function PlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<PlaylistDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api<PlaylistDetail>(`playlists/${id}`)
      .then((d) => !cancelled && setDetail(d))
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 400)) setMissing(true);
        else setError(errorMessage(e));
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (missing) {
    return (
      <Empty title="Playlist not found">
        It may have been deleted or made private. <LinkButton href="/playlists" variant="secondary" className="mt-3">Your playlists</LinkButton>
      </Empty>
    );
  }
  if (!detail) return error ? <ErrorNote message={error} /> : <Spinner />;

  async function save(items: TextSummary[], request: () => Promise<unknown>) {
    const before = detail;
    setDetail((d) => d && { ...d, items, playlist: { ...d.playlist, itemCount: items.length } });
    try {
      await request();
    } catch (e) {
      setDetail(before);
      setError(errorMessage(e));
    }
  }

  const base = `playlists/${detail.playlist.id}/items`;
  const move = (index: number, delta: number) => {
    const items = moveItem(detail.items, index, delta);
    void save(items, () => api(base, { method: "PUT", body: { textIds: items.map((t) => t.id) } }));
  };
  const remove = (t: TextSummary) => {
    void save(detail.items.filter((x) => x.id !== t.id), () => api(`${base}/${t.id}`, { method: "DELETE" }));
  };

  return (
    <div>
      <PlaylistHeader
        detail={detail}
        onChanged={(playlist) => setDetail((d) => d && { ...d, playlist: { ...d.playlist, ...playlist } })}
        onDeleted={() => router.push("/playlists")}
      />
      <ErrorNote message={error} />
      {detail.items.length === 0 && (
        <Empty title="Nothing here yet">
          {detail.playlist.mine ? "Add texts and videos with the playlist button on their cards in Library and Explore, or in the reader." : "The owner hasn't shared anything in it yet."}
        </Empty>
      )}
      <ol className="space-y-3" data-testid="playlist-items">
        {detail.items.map((t, i) => (
          <li key={t.id} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right text-sm text-muted tabular-nums">{i + 1}</span>
            <TextCard
              text={t} layout="list" className="min-w-0 flex-1" showOwner={!t.mine}
              href={playlistReadHref(t.id, detail.playlist.id)}
              actions={detail.playlist.mine && <ItemActions first={i === 0} last={i === detail.items.length - 1} onMove={(d) => move(i, d)} onRemove={() => remove(t)} />}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

function ItemActions({ first, last, onMove, onRemove }: { first: boolean; last: boolean; onMove: (delta: number) => void; onRemove: () => void }) {
  const button = "rounded-md px-2 py-1 text-xs text-muted hover:bg-paper hover:text-ink disabled:opacity-30";
  return (
    <>
      <button className={button} onClick={() => onMove(-1)} disabled={first} aria-label="Move up" title="Move up">↑</button>
      <button className={button} onClick={() => onMove(1)} disabled={last} aria-label="Move down" title="Move down">↓</button>
      <button className={`${button} text-danger`} onClick={onRemove} aria-label="Remove from playlist" title="Remove from playlist">Remove</button>
    </>
  );
}
