"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { TextDetail, Token } from "@/lib/types";
import { CloseIcon } from "../icons";
import { AudioSyncTools, type PlayerControls } from "./audio-sync-tools";
import { PlayerBar } from "./player-bar";
import type { Spoken } from "./media-nav";
import { NOTHING_SPOKEN, useMediaPlayer, type MediaElement, type MediaHandle } from "./use-media-player";

interface Props {
  textId: number;
  audio: TextDetail["audio"];
  tokens: Token[];
  isOwner: boolean;
  isPro: boolean;
  onSpoken: (spoken: Spoken) => void;
  onJumpToToken: (tokenIndex: number) => void;
  onAudioChanged: (audio: TextDetail["audio"]) => void;
  cueToken: number | null;
  onClose: () => void;
}

function AddAudio({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div data-bottom-bar className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 pt-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Add audio to this text</p>
          <button onClick={onClose} className="text-muted" aria-label="Close"><CloseIcon className="size-4" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const AudioPanel = forwardRef<MediaHandle, Props>(function AudioPanel(props, ref) {
  const { audio, tokens, onSpoken, onJumpToToken, cueToken } = props;
  const el = useRef<HTMLAudioElement>(null);
  const media = useMemo<MediaElement>(
    () => ({
      play: () => void el.current?.play(),
      pause: () => el.current?.pause(),
      seek: (ms) => {
        if (el.current) el.current.currentTime = ms / 1000;
      },
      currentMs: () => (el.current?.currentTime ?? 0) * 1000,
      setRate: (rate) => {
        if (el.current) el.current.playbackRate = rate;
      },
    }),
    [],
  );
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [showTools, setShowTools] = useState(!audio);
  const timings = useMemo(() => [...(audio?.timings ?? [])].sort((a, b) => a.s - b.s), [audio]);
  const player = useMediaPlayer({ media, timings, tokens, duration, playing, onSpoken, onJumpToToken, cueToken });

  useEffect(() => {
    const a = el.current;
    if (a && a.readyState >= HTMLMediaElement.HAVE_METADATA) setDuration(a.duration * 1000);
  }, []);

  useImperativeHandle(ref, () => ({
    playFromToken: player.playFromToken,
    startPage: player.startPage,
    pause: () => el.current?.pause(),
    shortcut: player.shortcut,
  }));

  const controls: PlayerControls = useMemo(
    () => ({
      currentMs: () => (el.current?.currentTime ?? 0) * 1000,
      durationMs: () => {
        const ms = Math.round((el.current?.duration ?? 0) * 1000);
        return Number.isFinite(ms) ? ms : 0;
      },
      restart: () => {
        if (!el.current) return;
        el.current.currentTime = 0;
        void el.current.play();
      },
      pause: () => el.current?.pause(),
    }),
    [],
  );

  const tools = props.isOwner && showTools && (
    <AudioSyncTools
      textId={props.textId}
      audio={audio}
      tokens={tokens}
      isPro={props.isPro}
      player={controls}
      onJumpToToken={onJumpToToken}
      onAudioChanged={props.onAudioChanged}
    />
  );

  if (!audio) return <AddAudio onClose={props.onClose}>{tools}</AddAudio>;

  return (
    <PlayerBar
      player={player}
      playing={playing}
      duration={duration}
      onClose={props.onClose}
      extra={props.isOwner && <button onClick={() => setShowTools(!showTools)} className="text-xs text-muted underline">Sync</button>}
    >
      <audio
        ref={el}
        src={audio.src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => {
          setPlaying(false);
          player.tick();
        }}
        onEnded={() => {
          setPlaying(false);
          onSpoken(NOTHING_SPOKEN);
        }}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration * 1000)}
        onTimeUpdate={() => !playing && player.tick()}
      />
      {timings.length === 0 && !showTools && (
        <p className="mt-2 text-xs text-muted">Audio isn&apos;t synced to the text yet{props.isOwner ? " — open Sync to align it." : "."}</p>
      )}
      {tools}
    </PlayerBar>
  );
});
