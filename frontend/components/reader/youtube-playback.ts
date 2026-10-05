// How the reader's player bar reads YouTube's player states.

/** Player states reported by onStateChange. */
export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

export interface Playback {
  /** Shown as playing (the Pause button). */
  playing: boolean;
  /** Playing but waiting for data, e.g. after a seek: the position doesn't move. */
  buffering: boolean;
}

/** Buffering keeps a playing video playing, so a seek doesn't flash the Play button; a paused one stays paused. */
export function playbackOf(wasPlaying: boolean, state: number): Playback {
  if (state === YT_STATE.PLAYING) return { playing: true, buffering: false };
  const buffering = wasPlaying && state === YT_STATE.BUFFERING;
  return { playing: buffering, buffering };
}
