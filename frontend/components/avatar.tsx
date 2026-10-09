"use client";

import { useState } from "react";
import { initialOf } from "@/lib/photo";

const SIZES = {
  xs: "size-4 text-[9px]",
  sm: "size-6 text-[11px]",
  md: "size-8 text-sm",
  lg: "size-24 text-3xl",
} as const;

export function Avatar({ name, photoUrl, size = "sm", className = "" }: {
  name: string;
  photoUrl: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = photoUrl && failed !== photoUrl;
  return (
    <span
      data-testid="avatar"
      data-photo={showPhoto ? "yes" : "no"}
      aria-hidden
      className={`inline-grid shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-accent-soft align-middle font-semibold text-ink ${SIZES[size]} ${className}`}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl} alt="" className="size-full object-cover" onError={() => setFailed(photoUrl)}
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailed(photoUrl);
          }}
        />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

export function Named({ name, photoUrl, size = "xs", className = "" }: {
  name: string;
  photoUrl: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 align-middle ${className}`}>
      <Avatar name={name} photoUrl={photoUrl} size={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}
