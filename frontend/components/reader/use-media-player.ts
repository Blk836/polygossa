"use client";

import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Token, WordTiming } from "@/lib/types";
import { firstWordOfSentence, sentenceSegments, type Segment } from "./audio-sync";
import { cueMs, loopRestart, segmentAt, sentenceStart, spokenAt, type MediaShortcut, type Spoken } from "./media-nav";
import { ListenContext } from "./use-reading-session";

export interface MediaElement {
  play(): void;
  pause(): void;
  seek(ms: number): void;
  currentMs(): number;
  setRate(rate: number): void;
}

export interface MediaHandle {
  playFromToken(tokenIndex: number): void;
  startPage(tokenIndex: number | null): void;
  pause(): void;
  shortcut(action: MediaShortcut): void;
}

interface Options {
  media: MediaElement;
  timings: WordTiming[];
  tokens: Token[];
  duration: number;
  playing: boolean;
  onSpoken: (spoken: Spoken) => void;
  onJumpToToken: (tokenIndex: number) => void;
  cueToken: number | null;
}

export const NOTHING_SPOKEN: Spoken = { token: null, sentence: null };

export function useMediaPlayer({ media, timings, tokens, duration, playing, onSpoken, onJumpToToken, cueToken }: Options) {
  const [time, setTime] = useState(0);
  const [touched, setTouchedState] = useState(false);
  const moved = useRef(false);
  const setTouched = useCallback((value: true) => {
    moved.current = value;
    setTouchedState(value);
  }, []);
  const cue = useMemo(() => cueMs(timings, cueToken), [timings, cueToken]);
  const [rate, setRateState] = useState(1);
  const [looped, setLooped] = useState<Segment | null>(null);
  const lastSpoken = useRef<Spoken>(NOTHING_SPOKEN);
  const pageStart = useRef<number | null>(null);
  const segments = useMemo(() => sentenceSegments(tokens, timings, duration), [tokens, timings, duration]);
  const firstWords = useMemo(() => firstWordOfSentence(tokens), [tokens]);
  const listen = useContext(ListenContext);

  useEffect(() => {
    listen?.set(playing, Date.now());
  }, [listen, playing]);

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
    else setTime(ms);
  }, [media, looped, playing, touched, follow, setTouched]);

  useEffect(() => {
    if (!touched && !moved.current && duration > 0) media.seek(cue);
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
      pageStart.current = null;
      setTouched(true);
      m.seek(ms);
      if (play) m.play();
      follow(ms);
    },
    [media, follow, setTouched],
  );

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
    if (!touched) setTime(cue);
    setTouched(true);
    if (playing) return media.pause();
    if (pageStart.current !== null) seek(pageStart.current);
    media.play();
  }, [media, playing, touched, cue, seek, setTouched]);

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
    [timings, seek, media, setTouched],
  );

  const startPage = useCallback(
    (tokenIndex: number | null) => {
      pageStart.current = null;
      if (!touched || tokenIndex === null) return;
      const ms = cueMs(timings, tokenIndex);
      if (playing) seek(ms);
      else pageStart.current = ms;
    },
    [touched, timings, playing, seek],
  );

  return { startPage, time: touched ? time : cue, rate, setRate, looped: looped !== null, toggleLoop, segments, seek, toggle, step, shortcut, playFromToken, tick };
}

export type MediaPlayer = ReturnType<typeof useMediaPlayer>;
