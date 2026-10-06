import { describe, expect, it } from "vitest";
import {
  CROP_START,
  MAX_PICK_BYTES,
  MAX_ZOOM,
  OUTPUT_SIZE,
  clampCrop,
  cropKey,
  dragCrop,
  initialOf,
  photoFileError,
  sourceSquare,
  zoomCrop,
} from "./photo";

describe("initialOf", () => {
  it("is the name's first letter, upper-cased, ignoring leading spaces", () => {
    expect(initialOf("  ana")).toBe("A");
    expect(initialOf("ben")).toBe("B");
  });

  it("keeps a whole character outside the basic plane", () => {
    expect(initialOf("𝒜lice")).toBe("𝒜");
  });

  it("falls back to the second choice, then a question mark", () => {
    expect(initialOf("", "zoe@x.co")).toBe("Z");
    expect(initialOf("", "  zoe@x.co")).toBe("Z");
    expect(initialOf("   ", "")).toBe("?");
    expect(initialOf("")).toBe("?");
  });
});

describe("photoFileError", () => {
  it("accepts JPEG, PNG and WebP", () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(photoFileError({ type, size: 1000 })).toBeNull();
    }
  });

  it("rejects other types, including other images", () => {
    for (const type of ["application/pdf", "text/plain", "image/gif", "image/svg+xml", ""]) {
      expect(photoFileError({ type, size: 1000 })).toBe("Please choose a JPEG, PNG or WebP image");
    }
  });

  it("rejects files over 20 MB, but not exactly 20 MB", () => {
    expect(MAX_PICK_BYTES).toBe(20 * 1024 * 1024);
    expect(photoFileError({ type: "image/png", size: MAX_PICK_BYTES })).toBeNull();
    expect(photoFileError({ type: "image/png", size: MAX_PICK_BYTES + 1 })).toBe("That image is too large (max 20 MB)");
  });

  it("names the type problem before the size problem", () => {
    expect(photoFileError({ type: "application/pdf", size: MAX_PICK_BYTES + 1 })).toBe("Please choose a JPEG, PNG or WebP image");
  });
});

// A 1200×800 landscape image in a 200px frame: at zoom 1 it is shown 300×200, so it can move 50px either side.
const landscape = { width: 1200, height: 800 };
const portrait = { width: 600, height: 900 };
const FRAME = 200;

describe("crop", () => {
  it("starts centred at zoom 1, and outputs 256px squares", () => {
    expect(CROP_START).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(OUTPUT_SIZE).toBe(256);
    expect(MAX_ZOOM).toBe(4);
  });

  it("at the start takes the largest centred square", () => {
    expect(sourceSquare(landscape, FRAME, CROP_START)).toEqual({ x: 200, y: 0, size: 800 });
    expect(sourceSquare(portrait, FRAME, CROP_START)).toEqual({ x: 0, y: 150, size: 600 });
  });

  it("dragging right shows more of the left side, up to the edge", () => {
    const moved = dragCrop(landscape, FRAME, CROP_START, 30, 0);
    expect(moved).toEqual({ zoom: 1, x: 30, y: 0 });
    expect(sourceSquare(landscape, FRAME, moved)).toEqual({ x: 80, y: 0, size: 800 });
    expect(dragCrop(landscape, FRAME, CROP_START, 500, 0)).toEqual({ zoom: 1, x: 50, y: 0 });
    expect(sourceSquare(landscape, FRAME, dragCrop(landscape, FRAME, CROP_START, 500, 0))).toEqual({ x: 0, y: 0, size: 800 });
    expect(dragCrop(landscape, FRAME, CROP_START, -500, 0)).toEqual({ zoom: 1, x: -50, y: 0 });
  });

  it("can't move along the side that already exactly fills the frame", () => {
    expect(dragCrop(landscape, FRAME, CROP_START, 0, 40)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(dragCrop(portrait, FRAME, CROP_START, 40, 0)).toEqual({ zoom: 1, x: 0, y: 0 });
    expect(dragCrop(portrait, FRAME, CROP_START, 0, -999)).toEqual({ zoom: 1, x: 0, y: -50 });
  });

  it("zooming in grows the image around the frame's centre", () => {
    const zoomed = zoomCrop(landscape, FRAME, CROP_START, 2);
    expect(zoomed).toEqual({ zoom: 2, x: 0, y: 0 });
    expect(sourceSquare(landscape, FRAME, zoomed)).toEqual({ x: 400, y: 200, size: 400 });
  });

  it("zooming scales the offset so the same point stays at the centre", () => {
    const moved = { zoom: 1, x: 20, y: 0 };
    expect(zoomCrop(landscape, FRAME, moved, 2)).toEqual({ zoom: 2, x: 40, y: 0 });
  });

  it("zooming from any zoom scales the offset by the change, on both axes", () => {
    expect(zoomCrop(landscape, FRAME, { zoom: 2, x: 20, y: 0 }, 4)).toEqual({ zoom: 4, x: 40, y: 0 });
    expect(zoomCrop(portrait, FRAME, { zoom: 1, x: 0, y: 20 }, 2)).toEqual({ zoom: 2, x: 0, y: 40 });
  });

  it("moving a portrait photo down shows more of its top", () => {
    expect(sourceSquare(portrait, FRAME, { zoom: 1, x: 0, y: 30 })).toEqual({ x: 0, y: 60, size: 600 });
  });

  it("zooming out pulls the image back so it still fills the frame", () => {
    const zoomedAndMoved = { zoom: 2, x: 200, y: 100 };
    expect(zoomCrop(landscape, FRAME, zoomedAndMoved, 1)).toEqual({ zoom: 1, x: 50, y: 0 });
  });

  it("keeps the zoom between 1 and 4", () => {
    expect(zoomCrop(landscape, FRAME, CROP_START, 0.5).zoom).toBe(1);
    expect(zoomCrop(landscape, FRAME, CROP_START, 9).zoom).toBe(4);
  });

  it("clampCrop leaves a state already inside the limits alone", () => {
    expect(clampCrop(landscape, FRAME, { zoom: 2, x: 10, y: -10 })).toEqual({ zoom: 2, x: 10, y: -10 });
    expect(clampCrop(landscape, FRAME, { zoom: 2, x: 200, y: -100 })).toEqual({ zoom: 2, x: 200, y: -100 });
    expect(clampCrop(landscape, FRAME, { zoom: 2, x: 201, y: -101 })).toEqual({ zoom: 2, x: 200, y: -100 });
  });

  it("the output square never reaches outside the image", () => {
    for (const s of [{ zoom: 1, x: 50, y: 0 }, { zoom: 4, x: -999, y: 999 }, { zoom: 2.5, x: 123, y: -77 }]) {
      const sq = sourceSquare(landscape, FRAME, clampCrop(landscape, FRAME, s));
      expect(sq.x).toBeGreaterThanOrEqual(0);
      expect(sq.y).toBeGreaterThanOrEqual(0);
      expect(sq.x + sq.size).toBeLessThanOrEqual(landscape.width + 1e-9);
      expect(sq.y + sq.size).toBeLessThanOrEqual(landscape.height + 1e-9);
    }
  });
});

describe("cropKey", () => {
  const mid = { zoom: 2, x: 0, y: 0 };

  it("arrow keys move the image 10px, like dragging", () => {
    expect(cropKey(landscape, FRAME, mid, "ArrowLeft")).toEqual({ zoom: 2, x: -10, y: 0 });
    expect(cropKey(landscape, FRAME, mid, "ArrowRight")).toEqual({ zoom: 2, x: 10, y: 0 });
    expect(cropKey(landscape, FRAME, mid, "ArrowUp")).toEqual({ zoom: 2, x: 0, y: -10 });
    expect(cropKey(landscape, FRAME, mid, "ArrowDown")).toEqual({ zoom: 2, x: 0, y: 10 });
  });

  it("+ and - (and =) zoom by 0.25", () => {
    expect(cropKey(landscape, FRAME, mid, "+")).toEqual({ zoom: 2.25, x: 0, y: 0 });
    expect(cropKey(landscape, FRAME, mid, "=")).toEqual({ zoom: 2.25, x: 0, y: 0 });
    expect(cropKey(landscape, FRAME, mid, "-")).toEqual({ zoom: 1.75, x: 0, y: 0 });
  });

  it("stays within the limits", () => {
    expect(cropKey(landscape, FRAME, CROP_START, "ArrowUp")).toEqual(CROP_START);
    expect(cropKey(landscape, FRAME, CROP_START, "-")).toEqual(CROP_START);
  });

  it("ignores other keys", () => {
    expect(cropKey(landscape, FRAME, mid, "a")).toBeNull();
    expect(cropKey(landscape, FRAME, mid, "Enter")).toBeNull();
  });
});
