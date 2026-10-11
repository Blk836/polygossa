"use client";

import { formatTime } from "./audio-sync";
import { PhoneBar } from "./phone-bar";
import { barClass, CloseButton, LoopButton, PlayButton, ReplayButton, SpeedSelect, StepButton, type PlayerBarProps } from "./player-controls";
import { PHONE, useMediaQuery } from "./use-media-query";

export function PlayerBar(props: PlayerBarProps) {
  const phone = useMediaQuery(PHONE);
  return phone ? <PhoneBar {...props} /> : <WideBar {...props} />;
}

function WideBar({ player, playing, duration, onClose, extra, children }: PlayerBarProps) {
  const max = duration || 1;
  const synced = player.segments.length > 0;
  return (
    <div role="region" aria-label="Player" data-bottom-bar className={barClass}>
      <div className="mx-auto max-w-6xl px-4 pt-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1">
            <StepButton player={player} synced={synced} by={-1} />
            <PlayButton player={player} playing={playing} />
            <StepButton player={player} synced={synced} by={1} />
            <ReplayButton player={player} synced={synced} />
            <LoopButton player={player} synced={synced} />
          </div>
          <div className="flex min-w-48 flex-1 items-center gap-2">
            <span className="w-10 text-xs tabular-nums text-muted">{formatTime(player.time)}</span>
            <input type="range" min={0} max={max} value={Math.min(player.time, max)} onChange={(e) => player.seek(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" aria-label="Seek" />
            <span className="w-10 text-xs tabular-nums text-muted">{formatTime(duration)}</span>
          </div>
          <SpeedSelect player={player} />
          {extra}
          {onClose && <CloseButton onClose={onClose} />}
        </div>
        {children}
      </div>
    </div>
  );
}
