export const MAX_PICK_BYTES = 20 * 1024 * 1024;
export const OUTPUT_SIZE = 256;
export const MAX_ZOOM = 4;

const PICKABLE = ["image/jpeg", "image/png", "image/webp"];
const KEY_STEP = 10;
const ZOOM_STEP = 0.25;

export type Size = { width: number; height: number };
export type Crop = { zoom: number; x: number; y: number };

export const CROP_START: Crop = { zoom: 1, x: 0, y: 0 };

export function initialOf(name: string, fallback = ""): string {
  const first = Array.from(name.trim() || fallback.trim())[0];
  return first ? first.toUpperCase() : "?";
}

export function photoFileError(file: { type: string; size: number }): string | null {
  if (!PICKABLE.includes(file.type)) return "Please choose a JPEG, PNG or WebP image";
  if (file.size > MAX_PICK_BYTES) return "That image is too large (max 20 MB)";
  return null;
}

function scaleOf(image: Size, frame: number, zoom: number) {
  return (frame / Math.min(image.width, image.height)) * zoom;
}

function clamp(value: number, limit: number) {
  return Math.min(limit, Math.max(-limit, value)) + 0;
}

export function clampCrop(image: Size, frame: number, crop: Crop): Crop {
  const zoom = Math.min(MAX_ZOOM, Math.max(1, crop.zoom));
  const scale = scaleOf(image, frame, zoom);
  return {
    zoom,
    x: clamp(crop.x, (image.width * scale - frame) / 2),
    y: clamp(crop.y, (image.height * scale - frame) / 2),
  };
}

export function dragCrop(image: Size, frame: number, crop: Crop, dx: number, dy: number): Crop {
  return clampCrop(image, frame, { ...crop, x: crop.x + dx, y: crop.y + dy });
}

export function zoomCrop(image: Size, frame: number, crop: Crop, zoom: number): Crop {
  const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
  const ratio = next / crop.zoom;
  return clampCrop(image, frame, { zoom: next, x: crop.x * ratio, y: crop.y * ratio });
}

export function cropKey(image: Size, frame: number, crop: Crop, key: string): Crop | null {
  const moves: Record<string, [number, number]> = {
    ArrowLeft: [-KEY_STEP, 0],
    ArrowRight: [KEY_STEP, 0],
    ArrowUp: [0, -KEY_STEP],
    ArrowDown: [0, KEY_STEP],
  };
  if (key in moves) return dragCrop(image, frame, crop, ...moves[key]);
  if (key === "+" || key === "=") return zoomCrop(image, frame, crop, crop.zoom + ZOOM_STEP);
  if (key === "-") return zoomCrop(image, frame, crop, crop.zoom - ZOOM_STEP);
  return null;
}

export function sourceSquare(image: Size, frame: number, crop: Crop): { x: number; y: number; size: number } {
  const scale = scaleOf(image, frame, crop.zoom);
  const size = frame / scale;
  return {
    x: image.width / 2 - crop.x / scale - size / 2,
    y: image.height / 2 - crop.y / scale - size / 2,
    size,
  };
}
