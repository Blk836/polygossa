"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Avatar } from "@/components/avatar";
import { useMe } from "@/components/me-context";
import { Button, ErrorNote } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { photoFileError } from "@/lib/photo";
import type { Me } from "@/lib/types";
import { PhotoCropper } from "./photo-cropper";

const UNREADABLE = "That image couldn't be read. Try another one.";

function decode(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error(UNREADABLE));
    };
    img.onload = () => (img.naturalWidth > 0 ? resolve(img) : fail());
    img.onerror = fail;
    img.src = url;
  });
}

export function ProfilePhoto() {
  const { me, setMe } = useMe();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<HTMLImageElement | null>(null);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (picked) URL.revokeObjectURL(picked.src);
  }, [picked]);

  async function onPick(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    const invalid = photoFileError(file);
    if (invalid) return setError(invalid);
    try {
      setPicked(await decode(file));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function upload(photo: Blob) {
    const body = new FormData();
    body.append("file", photo, "photo.jpg");
    setMe(await api<Me>("me/photo", { body }));
    setPicked(null);
  }

  async function remove() {
    setRemoving(true);
    setError(null);
    try {
      setMe(await api<Me>("me/photo", { method: "DELETE" }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <section aria-label="Profile photo" className="space-y-3 rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={me.displayName || me.email} photoUrl={me.photoUrl} size="lg" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => input.current?.click()}>
            {me.photoUrl ? "Change photo" : "Upload photo"}
          </Button>
          {me.photoUrl && (
            <Button type="button" variant="danger" disabled={removing} onClick={() => void remove()}>Remove photo</Button>
          )}
        </div>
        <input
          ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          aria-label="Choose a photo" data-testid="photo-input" onChange={(e) => void onPick(e)}
        />
      </div>
      <ErrorNote message={error} />
      {picked && <PhotoCropper image={picked} onSave={upload} onClose={() => setPicked(null)} />}
    </section>
  );
}
