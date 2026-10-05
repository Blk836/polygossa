import { describe, expect, it } from "vitest";
import { playbackOf } from "./youtube-playback";

// YouTube player states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued.
describe("YouTube playback state", () => {
  it("plays while playing, without buffering", () => {
    expect(playbackOf(false, 1)).toEqual({ playing: true, buffering: false });
    expect(playbackOf(true, 1)).toEqual({ playing: true, buffering: false });
  });

  it("keeps playing while it buffers mid-playback (e.g. after a seek)", () => {
    expect(playbackOf(true, 3)).toEqual({ playing: true, buffering: true });
  });

  it("stays paused while a paused (or not yet started) video buffers", () => {
    expect(playbackOf(false, 3)).toEqual({ playing: false, buffering: false });
  });

  it("stops on pause, end, unstarted and cued", () => {
    for (const state of [-1, 0, 2, 5]) {
      expect(playbackOf(true, state)).toEqual({ playing: false, buffering: false });
    }
  });
});
