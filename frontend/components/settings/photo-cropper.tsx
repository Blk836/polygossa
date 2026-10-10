"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Button, ErrorNote } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { CROP_START, MAX_ZOOM, OUTPUT_SIZE, cropKey, dragCrop, sourceSquare, zoomCrop, type Crop } from "@/lib/photo";

const FRAME = 240;

function render(image: HTMLImageElement, crop: Crop): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  const square = sourceSquare({ width: image.naturalWidth, height: image.naturalHeight }, FRAME, crop);
  ctx.drawImage(image, square.x, square.y, square.size, square.size, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("That image couldn't be read. Try another one."))), "image/jpeg", 0.9));
}

export function PhotoCropper({ image, onSave, onClose }: {
  image: HTMLImageElement;
  onSave: (photo: Blob) => Promise<void>;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [crop, setCrop] = useState<Crop>(CROP_START);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const size = { width: image.naturalWidth, height: image.naturalHeight };

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const from = drag.current;
    if (!from) return;
    drag.current = { x: e.clientX, y: e.clientY };
    setCrop((c) => dragCrop(size, FRAME, c, e.clientX - from.x, e.clientY - from.y));
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const next = cropKey(size, FRAME, crop, e.key);
    if (!next) return;
    e.preventDefault();
    setCrop(next);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSave(await render(image, crop));
    } catch (err) {
      setError(errorMessage(err));
      setSaving(false);
    }
  }

  const scale = (FRAME / Math.min(size.width, size.height)) * crop.zoom;
  const shown = { width: size.width * scale, height: size.height * scale };
  return (
    <dialog
      ref={dialog} aria-labelledby="crop-title" onClose={onClose}
      onClick={(e) => e.target === dialog.current && !saving && dialog.current.close()}
      onCancel={(e) => saving && e.preventDefault()}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-card p-5 text-ink shadow-2xl backdrop:bg-black/40"
    >
      <h2 id="crop-title" className="font-display text-xl font-semibold">Crop your photo</h2>
      <p className="mt-1 text-sm text-muted">Drag to move it, and zoom with the slider.</p>
      <div
        data-testid="crop-frame" tabIndex={0} role="application" aria-label="Photo position: arrow keys move it, plus and minus zoom"
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)} onKeyDown={onKeyDown}
        className="relative mx-auto mt-4 cursor-move touch-none overflow-hidden rounded-lg bg-paper select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        style={{ width: FRAME, height: FRAME }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL being cropped */}
        <img
          src={image.src} alt="" draggable={false} data-testid="crop-image"
          className="pointer-events-none absolute max-w-none"
          style={{ ...shown, left: (FRAME - shown.width) / 2 + crop.x, top: (FRAME - shown.height) / 2 + crop.y }}
        />
        <div aria-hidden className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.45)] ring-2 ring-white/80" />
      </div>
      <label className="mt-4 flex items-center gap-3 text-sm text-muted">
        Zoom
        <input
          type="range" min={1} max={MAX_ZOOM} step={0.01} value={crop.zoom} aria-label="Zoom"
          onChange={(e) => setCrop((c) => zoomCrop(size, FRAME, c, Number(e.target.value)))}
          className="flex-1 cursor-pointer accent-[var(--accent)]"
        />
      </label>
      <ErrorNote message={error} />
      <div className="mt-4 flex justify-end gap-2">
        <Button type="button" variant="secondary" disabled={saving} onClick={() => dialog.current?.close()}>Cancel</Button>
        <Button type="button" disabled={saving} onClick={() => void save()}>{saving ? "Saving…" : "Save photo"}</Button>
      </div>
    </dialog>
  );
}
