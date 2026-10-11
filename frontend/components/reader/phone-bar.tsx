"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { MoreIcon } from "../icons";
import { formatTime } from "./audio-sync";
import { barClass, CloseButton, LoopButton, PlayButton, ReplayButton, SpeedSelect, StepButton, type PlayerBarProps } from "./player-controls";

function useDismiss(open: boolean, area: RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onPointer = (e: PointerEvent) => {
      if (!area.current?.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open, area, close]);
}

function MoreControls({ player, synced, onClose, extra }: Pick<PlayerBarProps, "player" | "onClose" | "extra"> & { synced: boolean }) {
  const [open, setOpen] = useState(false);
  const area = useRef<HTMLDivElement>(null);
  const [close] = useState(() => () => setOpen(false));
  useDismiss(open, area, close);
  return (
    <div ref={area} className="flex justify-end">
      <button
        onClick={() => setOpen(!open)}
        className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink"
        aria-label="More player controls"
        aria-expanded={open}
      >
        <MoreIcon className="size-5" />
      </button>
      {open && (
        <div role="group" aria-label="Player options" className="absolute right-0 bottom-full mb-2 flex items-center gap-2 rounded-xl border border-line bg-card p-2 shadow-lg">
          <ReplayButton player={player} synced={synced} />
          <LoopButton player={player} synced={synced} />
          <SpeedSelect player={player} />
          {extra}
          {onClose && <CloseButton onClose={onClose} />}
        </div>
      )}
    </div>
  );
}

export function PhoneBar({ player, playing, duration, onClose, extra, children }: PlayerBarProps) {
  const max = duration || 1;
  const synced = player.segments.length > 0;
  return (
    <div role="region" aria-label="Player" data-bottom-bar className={barClass}>
      <div className="px-3">
        <input type="range" min={0} max={max} value={Math.min(player.time, max)} onChange={(e) => player.seek(Number(e.target.value))} className="block h-4 w-full accent-[var(--accent)]" aria-label="Seek" />
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-center pb-1">
          <span className="text-xs tabular-nums text-muted">{formatTime(player.time)} / {formatTime(duration)}</span>
          <div className="flex items-center gap-3">
            <StepButton player={player} synced={synced} by={-1} />
            <PlayButton player={player} playing={playing} />
            <StepButton player={player} synced={synced} by={1} />
          </div>
          <MoreControls player={player} synced={synced} onClose={onClose} extra={extra} />
        </div>
        {children}
      </div>
    </div>
  );
}
