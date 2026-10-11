"use client";

import type { ReactNode } from "react";
import { CloseIcon, PauseIcon, PlayIcon, RepeatIcon, ReplayIcon, SkipBackIcon, SkipForwardIcon } from "../icons";
import { chipSelectClass } from "../ui";
import { SPEEDS } from "./media-nav";
import type { MediaPlayer } from "./use-media-player";

const iconButton = "flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink disabled:opacity-40";

export interface PlayerBarProps {
  player: MediaPlayer;
  playing: boolean;
  duration: number;
  onClose: (() => void) | null;
  extra?: ReactNode;
  children?: ReactNode;
}

export const barClass = "safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur";

interface Controls {
  player: MediaPlayer;
  synced: boolean;
}

export function StepButton({ player, synced, by }: Controls & { by: -1 | 1 }) {
  const label = by < 0 ? "Previous sentence" : "Next sentence";
  return (
    <button onClick={() => player.step(by)} disabled={!synced} className={iconButton} aria-label={label} title={`${label} (${by < 0 ? "[" : "]"})`}>
      {by < 0 ? <SkipBackIcon className="size-4" /> : <SkipForwardIcon className="size-4" />}
    </button>
  );
}

export function PlayButton({ player, playing }: { player: MediaPlayer; playing: boolean }) {
  return (
    <button onClick={player.toggle} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink" aria-label={playing ? "Pause" : "Play"} title="Play / pause (Space)">
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}

export function ReplayButton({ player, synced }: Controls) {
  return (
    <button onClick={() => player.step(0)} disabled={!synced} className={iconButton} aria-label="Replay sentence" title="Replay sentence (R)">
      <ReplayIcon className="size-4" />
    </button>
  );
}

export function LoopButton({ player, synced }: Controls) {
  return (
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
  );
}

export function SpeedSelect({ player }: { player: MediaPlayer }) {
  return (
    <select value={player.rate} onChange={(e) => player.setRate(Number(e.target.value))} className={`${chipSelectClass} bg-card`} aria-label="Speed">
      {SPEEDS.map((r) => <option key={r} value={r}>{r}×</option>)}
    </select>
  );
}

export function CloseButton({ onClose }: { onClose: () => void }) {
  return <button onClick={onClose} className="text-muted" aria-label="Close player"><CloseIcon className="size-4" /></button>;
}
