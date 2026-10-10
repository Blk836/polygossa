"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { estimateTimings, youtubeWatchUrl } from "@/lib/media";
import type { TextDetail, Token } from "@/lib/types";
import { MiniPlayerIcon, SideBySideIcon } from "../icons";
import { createMediaClock, type MediaClock } from "./media-clock";
import { PlayerBar } from "./player-bar";
import type { Spoken } from "./media-nav";
import type { VideoLayout } from "./reader-settings";
import { useMediaPlayer, type MediaElement, type MediaHandle } from "./use-media-player";
import { loadYouTubeApi, type YTPlayer } from "./youtube-api";
import { playbackOf, YT_STATE } from "./youtube-playback";

interface Props {
  video: NonNullable<TextDetail["video"]>;
  tokens: Token[];
  onSpoken: (spoken: Spoken) => void;
  onJumpToToken: (tokenIndex: number) => void;
  cueToken: number | null;
  layout: VideoLayout;
  onLayout: (layout: VideoLayout) => void;
}

function PlayerFailed({ videoId }: { videoId: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-line bg-card p-4 text-center text-sm">
      <p>The video can&apos;t be played here, but you can still read the transcript.</p>
      <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer" className="text-accent underline">Watch on YouTube</a>
    </div>
  );
}

interface Cue {
  started: boolean;
  pending: number | null;
  clock: MediaClock;
}

function useYouTube(videoId: string, host: React.RefObject<HTMLDivElement | null>, player: React.RefObject<YTPlayer | null>, cue: React.RefObject<Cue>) {
  const [failed, setFailed] = useState(false);
  const [playback, setPlayback] = useState({ playing: false, buffering: false });
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let wasPlaying = false;
    let created: YTPlayer | null = null;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !host.current) return;
        const mount = document.createElement("div");
        host.current.replaceChildren(mount);
        created = new YT.Player(mount, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, enablejsapi: 1, origin: window.location.origin },
          events: {
            onReady: (e) => {
              player.current = e.target;
              setSeconds(e.target.getDuration());
            },
            onStateChange: (e) => {
              if (e.data === YT_STATE.PLAYING) startCued(e.target, cue.current);
              const next = playbackOf(wasPlaying, e.data);
              wasPlaying = next.playing;
              setPlayback(next);
            },
            onError: () => setFailed(true),
          },
        });
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      created?.destroy();
      player.current = null;
    };
  }, [videoId, host, player, cue]);
  return { failed, ...playback, seconds };
}

function startCued(yt: YTPlayer, cue: Cue) {
  const ms = cue.pending;
  cue.started = true;
  cue.pending = null;
  if (ms === null) return;
  cue.clock.seek(ms, performance.now());
  yt.seekTo(ms / 1000, true);
}

function dockClass(mini: boolean): string {
  const base = "sticky top-14 z-20 -mx-4 mb-6 bg-paper/95 px-4 pt-2 pb-3 backdrop-blur sm:mx-0 sm:px-0 lg:mb-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none";
  if (mini) return `${base} lg:fixed lg:top-auto lg:right-6 lg:bottom-[5.5rem] lg:z-30 lg:w-[200px]`;
  return `${base} lg:top-20`;
}

function LayoutButton({ layout, onLayout }: { layout: VideoLayout; onLayout: (layout: VideoLayout) => void }) {
  const mini = layout === "mini";
  const label = mini ? "Video beside text" : "Mini player";
  return (
    <button
      type="button"
      onClick={() => onLayout(mini ? "beside" : "mini")}
      className="hidden size-8 shrink-0 items-center justify-center rounded-full text-muted hover:bg-paper hover:text-ink lg:flex"
      aria-label={label}
      title={label}
    >
      {mini ? <SideBySideIcon className="size-4" /> : <MiniPlayerIcon className="size-4" />}
    </button>
  );
}

const VideoPlayer = forwardRef<MediaHandle, Props>(function VideoPlayer({ video, tokens, onSpoken, onJumpToToken, cueToken, layout, onLayout }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  const [smooth] = useState(createMediaClock);
  const clock = useRef({ playing: false, rate: 1 });
  const cue = useRef<Cue>({ started: false, pending: null, clock: smooth });
  const media = useMemo<MediaElement>(
    () => ({
      play: () => {
        if (yt.current) startCued(yt.current, cue.current);
        yt.current?.playVideo();
      },
      pause: () => yt.current?.pauseVideo(),
      seek: (ms) => {
        smooth.seek(ms, performance.now());
        if (cue.current.started && yt.current) yt.current.seekTo(ms / 1000, true);
        else cue.current.pending = ms;
      },
      currentMs: () => {
        const c = clock.current;
        return cue.current.pending ?? smooth.read((yt.current?.getCurrentTime() ?? 0) * 1000, performance.now(), c.playing, c.rate);
      },
      setRate: (rate) => {
        smooth.reset();
        clock.current.rate = rate;
        yt.current?.setPlaybackRate(rate);
      },
    }),
    [smooth],
  );
  const { failed, playing, buffering, seconds } = useYouTube(video.videoId, host, yt, cue);
  useEffect(() => {
    clock.current.playing = playing && !buffering;
  }, [playing, buffering]);
  const duration = (seconds || video.durationSeconds || 0) * 1000;
  const mini = layout === "mini" && !failed;

  const timings = useMemo(() => {
    const given = [...video.timings].sort((a, b) => a.s - b.s);
    return given.length ? given : estimateTimings(tokens, duration);
  }, [video.timings, tokens, duration]);
  const player = useMediaPlayer({ media, timings, tokens, duration, playing, onSpoken, onJumpToToken, cueToken });

  useImperativeHandle(ref, () => ({
    playFromToken: player.playFromToken,
    pause: () => yt.current?.pauseVideo(),
    shortcut: player.shortcut,
  }));

  return (
    <>
      <div className={dockClass(mini)} data-testid="video-dock" data-floating-player={mini || undefined}>
        {failed ? (
          <PlayerFailed videoId={video.videoId} />
        ) : (
          <div className={`mx-auto aspect-video max-h-[42vh] overflow-hidden rounded-xl bg-black lg:max-h-none ${mini ? "lg:aspect-square lg:shadow-2xl lg:ring-1 lg:ring-line" : ""}`}>
            <div ref={host} className="size-full" />
          </div>
        )}
      </div>
      {!failed && <PlayerBar player={player} playing={playing} duration={duration} onClose={null} extra={<LayoutButton layout={layout} onLayout={onLayout} />} />}
    </>
  );
});

export const VideoPanel = forwardRef<MediaHandle, Omit<Props, "video"> & { video: TextDetail["video"] }>(function VideoPanel({ video, ...props }, ref) {
  if (!video) return null;
  return (
    <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <VideoPlayer ref={ref} video={video} {...props} />
    </aside>
  );
});
