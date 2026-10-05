import { describe, expect, it } from "vitest";
import type { PlaylistDetail } from "./playlist-types";
import { deck, itemsLabel, moveItem, nextUp, parsePlaylistParam, playlistReadHref, positionIn, readerPlaylist, startLabel } from "./playlists";
import type { TextSummary } from "./types";

type Progress = TextSummary["progress"];
const item = (id: number, progress?: Progress) => ({ id, title: `T${id}`, progress }) as TextSummary;
const finished: Progress = { position: 0, percent: 100, completed: true };
const started: Progress = { position: 40, percent: 30, completed: false };

describe("nextUp", () => {
  it("is the first item not finished yet", () => {
    expect(nextUp([item(1, finished), item(2, started), item(3)])?.id).toBe(2);
    expect(nextUp([item(1, finished), item(2), item(3, started)])?.id).toBe(2);
    expect(nextUp([item(1), item(2)])?.id).toBe(1);
  });

  it("starts over once everything is finished, and is nothing for an empty playlist", () => {
    expect(nextUp([item(1, finished), item(2, finished)])?.id).toBe(1);
    expect(nextUp([])).toBeNull();
  });
});

describe("startLabel", () => {
  it("says Start before anything was opened, Continue part way, Read again when all are finished", () => {
    expect(startLabel([item(1), item(2)])).toBe("Start");
    expect(startLabel([item(1), item(2, started)])).toBe("Continue");
    expect(startLabel([item(1, finished), item(2)])).toBe("Continue");
    expect(startLabel([item(1, finished), item(2, finished)])).toBe("Read again");
    expect(startLabel([])).toBe("Start");
  });
});

describe("positionIn", () => {
  const items = [item(1), item(2), item(3)];

  it("finds the item with its neighbours", () => {
    expect(positionIn(items, 2)).toEqual({ index: 1, total: 3, previous: items[0], next: items[2] });
    expect(positionIn(items, 1)).toEqual({ index: 0, total: 3, previous: null, next: items[1] });
    expect(positionIn(items, 3)).toEqual({ index: 2, total: 3, previous: items[1], next: null });
  });

  it("is null for a text that isn't in the playlist", () => {
    expect(positionIn(items, 9)).toBeNull();
    expect(positionIn([], 1)).toBeNull();
  });
});

describe("moveItem", () => {
  it("swaps an item with its neighbour", () => {
    expect(moveItem([1, 2, 3], 1, -1)).toEqual([2, 1, 3]);
    expect(moveItem([1, 2, 3], 1, 1)).toEqual([1, 3, 2]);
  });

  it("leaves the order alone past either end, without changing the input", () => {
    const list = [1, 2, 3];
    expect(moveItem(list, 0, -1)).toEqual([1, 2, 3]);
    expect(moveItem(list, 2, 1)).toEqual([1, 2, 3]);
    expect(moveItem(list, 0, 1)).toEqual([2, 1, 3]);
    expect(list).toEqual([1, 2, 3]);
  });
});

describe("itemsLabel", () => {
  it("counts items and finished ones", () => {
    expect(itemsLabel({ itemCount: 0, completedCount: 0 })).toBe("Empty");
    expect(itemsLabel({ itemCount: 1, completedCount: 0 })).toBe("1 item");
    expect(itemsLabel({ itemCount: 5, completedCount: 0 })).toBe("5 items");
    expect(itemsLabel({ itemCount: 5, completedCount: 2 })).toBe("5 items · 2 finished");
    expect(itemsLabel({ itemCount: 5, completedCount: 5 })).toBe("5 items · all finished");
    expect(itemsLabel({ itemCount: 1, completedCount: 1 })).toBe("1 item · all finished");
  });
});

describe("playlist links", () => {
  it("opens a text in the reader as part of a playlist", () => {
    expect(playlistReadHref(12, 3)).toBe("/read/12?playlist=3");
  });

  it("reads the playlist id from the reader's URL, ignoring anything that isn't one", () => {
    expect(parsePlaylistParam("3")).toBe(3);
    expect(parsePlaylistParam("12")).toBe(12);
    expect(parsePlaylistParam("1.5")).toBeNull();
    expect(parsePlaylistParam("99999999999999999999")).toBeNull();
    expect(parsePlaylistParam(["4", "5"])).toBe(4);
    expect(parsePlaylistParam(undefined)).toBeNull();
    expect(parsePlaylistParam("")).toBeNull();
    expect(parsePlaylistParam("3x")).toBeNull();
    expect(parsePlaylistParam("-3")).toBeNull();
    expect(parsePlaylistParam("0")).toBeNull();
    expect(parsePlaylistParam([])).toBeNull();
  });
});

describe("readerPlaylist", () => {
  const detail = { playlist: { id: 3, title: "Podcast" }, items: [item(1), item(2), item(3)], privateItems: 0 } as unknown as PlaylistDetail;

  it("gives the reader the playlist, its place in it and the titles either side", () => {
    expect(readerPlaylist(detail, 2)).toEqual({
      id: 3, title: "Podcast", index: 1, total: 3, previous: { id: 1, title: "T1" }, next: { id: 3, title: "T3" },
    });
    expect(readerPlaylist(detail, 1)).toMatchObject({ index: 0, previous: null, next: { id: 2, title: "T2" } });
    expect(readerPlaylist(detail, 3)).toMatchObject({ index: 2, previous: { id: 2, title: "T2" }, next: null });
  });

  it("is null without a playlist, or when the text is not in it", () => {
    expect(readerPlaylist(null, 2)).toBeNull();
    expect(readerPlaylist(detail, 9)).toBeNull();
  });
});

describe("deck", () => {
  const cover = (textId: number) => ({ textId, title: `T${textId}`, category: "other" as const });

  it("puts the first item in front, straight, with the next ones fanned out behind it", () => {
    expect(deck([cover(1), cover(2), cover(3)])).toEqual([
      { cover: cover(3), rotate: -8, shift: -16 },
      { cover: cover(2), rotate: 8, shift: 16 },
      { cover: cover(1), rotate: 0, shift: 0 },
    ]);
    expect(deck([cover(1), cover(2)])).toEqual([
      { cover: cover(2), rotate: 8, shift: 16 },
      { cover: cover(1), rotate: 0, shift: 0 },
    ]);
    expect(deck([cover(1)])).toEqual([{ cover: cover(1), rotate: 0, shift: 0 }]);
  });

  it("draws at most three cards, and none for an empty playlist", () => {
    expect(deck([cover(1), cover(2), cover(3), cover(4)]).map((c) => c.cover.textId)).toEqual([3, 2, 1]);
    expect(deck([])).toEqual([]);
  });
});
