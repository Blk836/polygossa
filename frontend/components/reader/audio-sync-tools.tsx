"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, api, errorMessage } from "@/lib/api";
import type { TextDetail, Token, WordTiming } from "@/lib/types";
import { Button, ErrorNote, UpgradeNote, inputClass } from "../ui";
import { firstWordOfSentence } from "./audio-sync";

type Audio = TextDetail["audio"];

/** What the sync tools need from the audio player (owned by AudioPanel). */
export interface PlayerControls {
  currentMs: () => number;
  /** 0 until the audio's metadata has loaded. */
  durationMs: () => number;
  restart: () => void;
  pause: () => void;
}

interface Props {
  textId: number;
  audio: Audio;
  tokens: Token[];
  isPro: boolean;
  player: PlayerControls;
  onJumpToToken: (tokenIndex: number) => void;
  onAudioChanged: (audio: Audio) => void;
}

type Run = <T>(fn: () => Promise<T>) => Promise<T | undefined>;

function AttachAudio({ textId, hasAudio, busy, run, onAudioChanged }: {
  textId: number;
  hasAudio: boolean;
  busy: boolean;
  run: Run;
  onAudioChanged: (audio: Audio) => void;
}) {
  const [linkUrl, setLinkUrl] = useState("");
  async function replace(request: () => Promise<TextDetail>) {
    const detail = await run(request);
    if (detail) onAudioChanged(detail.audio);
  }
  function upload(file: File) {
    const form = new FormData();
    form.append("file", file);
    void replace(() => api<TextDetail>(`texts/${textId}/audio`, { body: form }));
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 hover:bg-paper">
        {hasAudio ? "Replace audio file" : "Upload audio file"}
        <input type="file" accept="audio/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </label>
      <span className="text-muted">or</span>
      <input className={`${inputClass} max-w-64 py-1.5`} placeholder="Link to an audio URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} />
      <Button
        variant="secondary"
        disabled={!linkUrl || busy}
        onClick={() => replace(() => api<TextDetail>(`texts/${textId}/audio-url`, { method: "PUT", body: { url: linkUrl } }))}
      >
        Link
      </Button>
    </div>
  );
}

/** Tap-to-sync: the user taps (or presses Space) as each sentence starts while the audio plays. */
function useTapSync(tokens: Token[], player: PlayerControls, onJumpToToken: (i: number) => void) {
  const [marks, setMarks] = useState<{ sentence: number; startMs: number }[] | null>(null);
  const firstWords = useMemo(() => firstWordOfSentence(tokens), [tokens]);
  const sentenceCount = firstWords.size;

  const tap = useCallback(() => {
    const now = Math.round(player.currentMs());
    setMarks((m) => {
      if (!m || m.length >= sentenceCount) return m;
      // Point the reader at the sentence whose start the user should tap next.
      const upcoming = firstWords.get(m.length + 1);
      if (upcoming !== undefined) onJumpToToken(upcoming);
      return [...m, { sentence: m.length, startMs: now }];
    });
  }, [player, sentenceCount, firstWords, onJumpToToken]);

  const tapping = marks !== null;
  useEffect(() => {
    if (!tapping) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      tap();
    };
    // Capture phase, so this runs before (and, by preventing the default, instead of) the play/pause shortcut.
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [tapping, tap]);

  function start() {
    setMarks([]);
    onJumpToToken(firstWords.get(0) ?? 0);
    player.restart();
  }

  function cancel() {
    setMarks(null);
    player.pause();
  }

  return { marks, sentenceCount, tap, start, cancel, stop: () => setMarks(null) };
}

function SyncActions({ hasCues, busy, tapSync, onAutoSync, onSaveTaps, onRemove }: {
  hasCues: boolean;
  busy: boolean;
  tapSync: ReturnType<typeof useTapSync>;
  onAutoSync: () => void;
  onSaveTaps: () => void;
  onRemove: () => void;
}) {
  const { marks } = tapSync;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" disabled={busy || marks !== null} onClick={onAutoSync}>
        {hasCues ? "Sync from subtitles" : "Auto-sync (estimate)"}
      </Button>
      {marks === null ? (
        <Button variant="secondary" disabled={busy} onClick={tapSync.start}>Tap-sync by sentence</Button>
      ) : (
        <>
          <Button onClick={tapSync.tap}>Next sentence ({marks.length}/{tapSync.sentenceCount}) — or press Space</Button>
          <Button variant="secondary" onClick={onSaveTaps} disabled={busy || marks.length === 0}>Save sync</Button>
          <Button variant="ghost" onClick={tapSync.cancel}>Cancel</Button>
        </>
      )}
      <Button variant="danger" className="ml-auto" disabled={busy} onClick={onRemove}>Remove audio</Button>
    </div>
  );
}

/** Owner tools: attach audio (upload or link), align it (auto or tap-to-sync by sentence), or remove it. */
export function AudioSyncTools({ textId, audio, tokens, isPro, player, onJumpToToken, onAudioChanged }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const tapSync = useTapSync(tokens, player, onJumpToToken);

  const run: Run = async (fn) => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof ApiError ? e : errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  async function saveTimings(path: string, body: Record<string, unknown>) {
    const r = await run(() => api<{ timings: WordTiming[] }>(`texts/${textId}/timings/${path}`, { body }));
    if (r && audio) onAudioChanged({ ...audio, timings: r.timings });
  }

  function autoSync() {
    const ms = player.durationMs();
    if (!ms) return setError("Play the audio for a moment so its length is known, then try again.");
    void saveTimings("auto", { durationMs: ms });
  }

  async function finishTapSync() {
    player.pause();
    await saveTimings("marks", { marks: tapSync.marks, durationMs: player.durationMs() || 1 });
    tapSync.stop();
  }

  async function removeAudio() {
    await run(() => api(`texts/${textId}/audio`, { method: "DELETE" }));
    onAudioChanged(null);
  }

  if (!isPro) return <div className="mt-3 border-t border-line pt-3"><UpgradeNote message="Audio sync is a Pro feature." /></div>;
  const { marks } = tapSync;
  const upgrade = error instanceof ApiError && error.upgradeRequired;
  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3 pb-1 text-sm">
      <AttachAudio textId={textId} hasAudio={!!audio} busy={busy} run={run} onAudioChanged={onAudioChanged} />
      {audio && (
        <SyncActions hasCues={audio.hasCues} busy={busy} tapSync={tapSync} onAutoSync={autoSync} onSaveTaps={finishTapSync} onRemove={removeAudio} />
      )}
      {marks !== null && <p className="text-xs text-muted">Tap “Next sentence” (or Space) the moment each highlighted sentence begins.</p>}
      {upgrade ? <UpgradeNote message={error.message} /> : <ErrorNote message={error instanceof ApiError ? error.message : error} />}
    </div>
  );
}
