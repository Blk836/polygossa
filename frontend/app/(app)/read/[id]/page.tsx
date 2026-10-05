import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { Reader } from "@/components/reader/reader";
import { parseReaderSettings, READER_SETTINGS_COOKIE } from "@/components/reader/reader-settings";
import { parsePlaylistParam, readerPlaylist } from "@/lib/playlists";
import type { PlaylistDetail } from "@/lib/playlist-types";
import { backendJson } from "@/lib/server-api";
import type { TextDetail } from "@/lib/types";

async function load(id: string) {
  if (!/^\d+$/.test(id)) return null;
  return backendJson<TextDetail>(`/api/texts/${id}`);
}

/** The playlist the text was opened from (`?playlist=3`); none if it is missing, private or doesn't hold the text. */
async function loadPlaylist(id: number | null, textId: number) {
  if (id === null) return null;
  return readerPlaylist(await backendJson<PlaylistDetail>(`/api/playlists/${id}`), textId);
}

export async function generateMetadata({ params }: PageProps<"/read/[id]">): Promise<Metadata> {
  const detail = await load((await params).id);
  return { title: detail?.text.title ?? "Reader" };
}

/** Server-rendered so the article text arrives with the page; interactivity hydrates on the client. */
export default async function ReadPage({ params, searchParams }: PageProps<"/read/[id]">) {
  const detail = await load((await params).id);
  if (!detail) notFound();
  const settings = parseReaderSettings((await cookies()).get(READER_SETTINGS_COOKIE)?.value);
  const playlist = await loadPlaylist(parsePlaylistParam((await searchParams).playlist), detail.text.id);
  return <Reader key={detail.text.id} initial={detail} initialSettings={settings} playlist={playlist} />;
}
