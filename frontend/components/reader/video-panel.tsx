"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { estimateTimings, youtubeWatchUrl } from "@/lib/media";
import type { TextDetail, Token } from "@/lib/types";
import { createMediaClock, type MediaClock } from "./media-clock";
import { PlayerBar } from "./player-bar";
import { useMediaPlayer, type MediaElement, type MediaHandle } from "./use-media-player";
import { loadYouTubeApi, type YTPlayer } from "./youtube-api";
import { playbackOf, YT_STATE } from "./youtube-playback";

interface Props {
  video: NonNullable<TextDetail["video"]>;
  tokens: Token[];
  onActiveToken: (tokenIndex: number | null) => void;
  onJumpToToken: (tokenIndex: number) => void;
  /** Where to cue the paused video: see `useMediaPlayer`. */
  cueToken: number | null;
}

/** Shown when embedding fails (blocked, offline, removed): the transcript stays fully usable. */
function PlayerFailed({ videoId }: { videoId: string }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-line bg-card p-4 text-center text-sm">
      <p>The video can&apos;t be played here, but you can still read the transcript.</p>
      <a href={youtubeWatchUrl(videoId)} target="_blank" rel="noreferrer" className="text-accent underline">Watch on YouTube</a>
    </div>
  );
}

/**
 * Seeking an unstarted YouTube video starts playing it, so until it has played a seek is only remembered (`pending`)
 * and applied when playback starts, from our Play button or YouTube's own.
 */
interface Cue {
  started: boolean;
  pending: number | null;
  /** Holds a seek's target as the position until YouTube reports it. */
  clock: MediaClock;
}

/** Creates the YouTube player in `host`, reporting its length, play state (buffering mid-play counts as playing) and failure. */
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
          // enablejsapi + origin keep the postMessage channel (state changes, current time) working.
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

/** First playback: jump to the remembered cue, if any. */
function startCued(yt: YTPlayer, cue: Cue) {
  const ms = cue.pending;
  cue.started = true;
  cue.pending = null; // before seeking: the seek itself can report "playing" and land back here
  if (ms === null) return;
  cue.clock.seek(ms, performance.now());
  yt.seekTo(ms / 1000, true);
}

/**
 * A video lesson's player: the YouTube player (sticky above the text on narrow screens, beside it on wide ones) and the same
 * bottom player bar as audio texts, which highlights the word being spoken and follows clicks on the transcript.
 */
const VideoPlayer = forwardRef<MediaHandle, Props>(function VideoPlayer({ video, tokens, onActiveToken, onJumpToToken, cueToken }, ref) {
  const host = useRef<HTMLDivElement>(null);
  const yt = useRef<YTPlayer | null>(null);
  // YouTube reports its time only a few times a second; the clock fills in between so the highlight keeps pace.
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
    clock.current.playing = playing && !buffering; // while buffering the position waits for the data
  }, [playing, buffering]);
  const duration = (seconds || video.durationSeconds || 0) * 1000;

  // Captions give exact timings; without them, spread the words over the length the player reports.
  const timings = useMemo(() => {
    const given = [...video.timings].sort((a, b) => a.s - b.s);
    return given.length ? given : estimateTimings(tokens, duration);
  }, [video.timings, tokens, duration]);
  const player = useMediaPlayer({ media, timings, tokens, duration, playing, onActiveToken, onJumpToToken, cueToken });

  useImperativeHandle(ref, () => ({
    playFromToken: player.playFromToken,
    pause: () => yt.current?.pauseVideo(),
    shortcut: player.shortcut,
  }));

  return (
    <>
      <div className="sticky top-14 z-20 -mx-4 mb-6 bg-paper/95 px-4 pt-2 pb-3 backdrop-blur sm:mx-0 sm:px-0 lg:top-20 lg:mb-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none" data-testid="video-dock">
        {failed ? (
          <PlayerFailed videoId={video.videoId} />
        ) : (
          <div className="mx-auto aspect-video max-h-[42vh] overflow-hidden rounded-xl bg-black lg:max-h-none">
            <div ref={host} className="size-full" />
          </div>
        )}
      </div>
      {!failed && <PlayerBar player={player} playing={playing} duration={duration} onClose={null} />}
    </>
  );
});

/** The video column (beside the text on wide screens); nothing for texts without a video. */
export const VideoPanel = forwardRef<MediaHandle, Omit<Props, "video"> & { video: TextDetail["video"] }>(function VideoPanel({ video, ...props }, ref) {
  if (!video) return null;
  return (
    <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1">
      <VideoPlayer ref={ref} video={video} {...props} />
    </aside>
  );
});
