"use client";

import type { ReactNode } from "react";
import { CloseIcon, PauseIcon, PlayIcon, RepeatIcon, ReplayIcon, SkipBackIcon, SkipForwardIcon } from "../icons";
import { chipSelectClass } from "../ui";
import { formatTime } from "./audio-sync";
import { SPEEDS } from "./media-nav";
import type { MediaPlayer } from "./use-media-player";

const iconButton = "flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink disabled:opacity-40";

function Transport({ player, playing, synced }: { player: MediaPlayer; playing: boolean; synced: boolean }) {
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => player.step(-1)} disabled={!synced} className={iconButton} aria-label="Previous sentence" title="Previous sentence ([)">
        <SkipBackIcon className="size-4" />
      </button>
      <button onClick={player.toggle} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink" aria-label={playing ? "Pause" : "Play"} title="Play / pause (Space)">
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <button onClick={() => player.step(1)} disabled={!synced} className={iconButton} aria-label="Next sentence" title="Next sentence (])">
        <SkipForwardIcon className="size-4" />
      </button>
      <button onClick={() => player.step(0)} disabled={!synced} className={iconButton} aria-label="Replay sentence" title="Replay sentence (R)">
        <ReplayIcon className="size-4" />
      </button>
      <button
        onClick={player.toggleLoop}
        disabled={!synced}
        className={`${iconButton} ${player.looped ? "bg-accent-soft text-ink" : ""}`}
        aria-label="Loop sentence"
        aria-pressed={player.looped}
        title="Loop sentence"
      >
        <RepeatIcon className="size-4" />
      </button>
    </div>
  );
}

/**
 * The player bar every audio text and video shares, fixed to the bottom of the screen: sentence steps, play/pause,
 * loop, seek and speed. `extra` holds panel-specific buttons (audio's Sync).
 */
export function PlayerBar({ player, playing, duration, onClose, extra, children }: {
  player: MediaPlayer;
  playing: boolean;
  duration: number;
  /** Null hides the close button (videos). */
  onClose: (() => void) | null;
  extra?: ReactNode;
  children?: ReactNode;
}) {
  const max = duration || 1;
  const synced = player.segments.length > 0;
  return (
    <div role="region" aria-label="Player" data-bottom-bar className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur">
      <div className="mx-auto max-w-6xl px-4 pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <Transport player={player} playing={playing} synced={synced} />
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <span className="w-10 text-xs tabular-nums text-muted">{formatTime(player.time)}</span>
            <input type="range" min={0} max={max} value={Math.min(player.time, max)} onChange={(e) => player.seek(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" aria-label="Seek" />
            <span className="w-10 text-xs tabular-nums text-muted">{formatTime(duration)}</span>
          </div>
          <select value={player.rate} onChange={(e) => player.setRate(Number(e.target.value))} className={`${chipSelectClass} bg-card`} aria-label="Speed">
            {SPEEDS.map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
          {extra}
          {onClose && <button onClick={onClose} className="text-muted" aria-label="Close player"><CloseIcon className="size-4" /></button>}
        </div>
        {children}
      </div>
    </div>
  );
}
