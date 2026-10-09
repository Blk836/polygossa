export class ListenClock {
  private since: number | null = null;
  private ms = 0;

  set(playing: boolean, now: number) {
    if (playing && this.since === null) this.since = now;
    else if (!playing && this.since !== null) {
      this.ms += now - this.since;
      this.since = null;
    }
  }

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
