/** Time the audio or video has played since the last heartbeat; parts of a second carry over to the next one. */
export class ListenClock {
  private since: number | null = null;
  private ms = 0;

  /** Called whenever playback starts or stops; repeats are ignored. */
  set(playing: boolean, now: number) {
    if (playing && this.since === null) this.since = now;
    else if (!playing && this.since !== null) {
      this.ms += now - this.since;
      this.since = null;
    }
  }

  /** Whole seconds played since the last call (counting a play still going on). */
  take(now: number): number {
    if (this.since !== null) {
      this.ms += now - this.since;
      this.since = now;
    }
    const seconds = Math.floor(this.ms / 1000);
    this.ms -= seconds * 1000;
    return seconds;
  }
}
