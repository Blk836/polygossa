"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Token, WordTiming } from "@/lib/types";
import { firstWordOfSentence, sentenceSegments, type Segment } from "./audio-sync";
import { cueMs, loopRestart, segmentAt, sentenceStart, spokenAt, type MediaShortcut, type Spoken } from "./media-nav";
import { ListenContext } from "./use-reading-session";

/** What the shared player needs from an <audio> element or the YouTube player. */
export interface MediaElement {
  play(): void;
  pause(): void;
  seek(ms: number): void;
  currentMs(): number;
  setRate(rate: number): void;
}

/** What the reader can ask of whichever player is showing. */
export interface MediaHandle {
  /** Seek to a word and start playing. */
  playFromToken(tokenIndex: number): void;
  pause(): void;
  shortcut(action: MediaShortcut): void;
}

interface Options {
  /** Stable (memoized) adapter over the player. */
  media: MediaElement;
  timings: WordTiming[];
  tokens: Token[];
  /** 0 until the media reports its length. */
  duration: number;
  playing: boolean;
  /** The word and sentence being spoken, whenever either changes. */
  onSpoken: (spoken: Spoken) => void;
  onJumpToToken: (tokenIndex: number) => void;
  /** First token of the page shown (null on page 1): paused media is cued there until the listener plays or seeks. */
  cueToken: number | null;
}

/**
 * Shared playback logic for audio and video: follows the spoken word, steps and loops sentences, sets the speed, and
 * cues the start of the page shown until first played or seeked. The audio and video panels own their element and
 * report `playing` and `duration`.
 */
export const NOTHING_SPOKEN: Spoken = { token: null, sentence: null };

export function useMediaPlayer({ media, timings, tokens, duration, playing, onSpoken, onJumpToToken, cueToken }: Options) {
  const [time, setTime] = useState(0);
  const [touched, setTouched] = useState(false);
  const cue = useMemo(() => cueMs(timings, cueToken), [timings, cueToken]);
  const [rate, setRateState] = useState(1);
  const [looped, setLooped] = useState<Segment | null>(null);
  const lastSpoken = useRef<Spoken>(NOTHING_SPOKEN);
  const segments = useMemo(() => sentenceSegments(tokens, timings, duration), [tokens, timings, duration]);
  const firstWords = useMemo(() => firstWordOfSentence(tokens), [tokens]);
  const listen = useContext(ListenContext);

  // Playing time counts as listening (Progress, daily goals).
  useEffect(() => {
    listen?.set(playing, Date.now());
  }, [listen, playing]);

  /** Shows `ms` as the position and points the reader at the word and sentence spoken then (turning the page to it). */
  const follow = useCallback(
    (ms: number) => {
      setTime(ms);
      const current = spokenAt(timings, segments, ms);
      const last = lastSpoken.current;
      if (current.token !== last.token || current.sentence !== last.sentence) {
        lastSpoken.current = current;
        onSpoken(current);
      }
    },
    [timings, segments, onSpoken],
  );

  const tick = useCallback(() => {
    const m = media;
    let ms = m.currentMs();
    const restart = loopRestart(looped, ms);
    if (restart !== null && playing) {
      m.seek(restart);
      ms = restart;
    }
    if (playing) setTouched(true);
    if (playing || touched) follow(ms);
    else setTime(ms); // a cue alone highlights nothing
  }, [media, looped, playing, touched, follow]);

  // Once the media knows its length (it can't seek before), keep it on the cue.
  useEffect(() => {
    if (!touched && duration > 0) media.seek(cue);
  }, [media, cue, touched, duration]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const loop = () => {
      tick();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing, tick]);

  const seek = useCallback(
    (ms: number, play = false) => {
      const m = media;
      setTouched(true);
      m.seek(ms);
      if (play) m.play();
      follow(ms); // not the player's position: YouTube reports it a moment later
    },
    [media, follow],
  );

  /** Seeks to a sentence and points the reader at it; a looped sentence follows. */
  const goToSentence = useCallback(
    (seg: Segment) => {
      seek(seg.start, true);
      setLooped((l) => (l ? seg : null));
      const tokenIndex = firstWords.get(seg.sentence);
      if (tokenIndex !== undefined) onJumpToToken(tokenIndex);
    },
    [seek, firstWords, onJumpToToken],
  );

  const step = useCallback(
    (dir: -1 | 0 | 1) => {
      const ms = media.currentMs() ?? time;
      const start = sentenceStart(segments, ms, dir);
      const seg = segments.find((s) => s.start === start);
      if (seg) goToSentence(seg);
    },
    [media, time, segments, goToSentence],
  );

  const toggle = useCallback(() => {
    if (!touched) setTime(cue); // the bar showed the cue: keep it there while the media starts (YouTube buffers first)
    setTouched(true);
    if (playing) media.pause();
    else media.play();
  }, [media, playing, touched, cue]);

  const toggleLoop = useCallback(() => {
    const k = segmentAt(segments, media.currentMs() ?? time);
    setLooped((l) => (l || k < 0 ? null : segments[k]));
  }, [segments, media, time]);

  const setRate = useCallback(
    (r: number) => {
      setRateState(r);
      media.setRate(r);
    },
    [media],
  );

  const shortcut = useCallback(
    (action: MediaShortcut) => {
      if (action === "toggle") return toggle();
      step(action === "replay" ? 0 : action === "previous" ? -1 : 1);
    },
    [toggle, step],
  );

  const playFromToken = useCallback(
    (tokenIndex: number) => {
      const timing = timings.find((t) => t.i === tokenIndex);
      if (timing) return seek(timing.s, true);
      setTouched(true);
      media.play();
    },
    [timings, seek, media],
  );

  return { time: touched ? time : cue, rate, setRate, looped: looped !== null, toggleLoop, segments, seek, toggle, step, shortcut, playFromToken, tick };
}

export type MediaPlayer = ReturnType<typeof useMediaPlayer>;
