"use client";

import { useState } from "react";
import { initialOf } from "@/lib/photo";

const SIZES = {
  xs: "size-4 text-[9px]",
  sm: "size-6 text-[11px]",
  md: "size-8 text-sm",
  lg: "size-24 text-3xl",
} as const;

/**
 * A person's round profile photo, or their initial when they have none or it fails to load. Decorative by default,
 * since their name is always shown beside it.
 */
export function Avatar({ name, photoUrl, size = "sm", className = "" }: {
  name: string;
  photoUrl: string | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  // Remembers which URL failed, so a new photo gets its own chance to load.
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
        // A plain img: photos come through the BFF with the session cookie, which next/image's optimiser wouldn't send.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl} alt="" className="size-full object-cover" onError={() => setFailed(photoUrl)}
          // A server-rendered photo can fail before hydration, when React isn't listening for the error yet.
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

/** A name with the person's avatar before it, for bylines and lists. */
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
