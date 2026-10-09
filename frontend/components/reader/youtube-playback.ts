export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

export interface Playback {
  playing: boolean;
  buffering: boolean;
}

export function playbackOf(wasPlaying: boolean, state: number): Playback {
  if (state === YT_STATE.PLAYING) return { playing: true, buffering: false };
  const buffering = wasPlaying && state === YT_STATE.BUFFERING;
  return { playing: buffering, buffering };
}
