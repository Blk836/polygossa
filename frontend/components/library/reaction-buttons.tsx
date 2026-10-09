"use client";

import type { Reaction } from "@/lib/media";
import type { TextSummary } from "@/lib/types";
import { BookmarkIcon, HeartIcon } from "../icons";

export function ReactionButtons({ text, onToggle }: { text: TextSummary; onToggle: (reaction: Reaction) => void }) {
  return (
    <>
      <button
        onClick={() => onToggle("like")}
        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs ${text.liked ? "text-rubric" : "text-muted hover:text-ink"}`}
        aria-pressed={text.liked}
        aria-label={text.liked ? "Unlike" : "Like"}
      >
        <HeartIcon filled={text.liked} className="size-4" /> {text.likes ?? 0}
      </button>
      <button
        onClick={() => onToggle("bookmark")}
        className={`ml-auto flex items-center gap-1 rounded-md px-2 py-1 text-xs ${text.bookmarked ? "text-accent" : "text-muted hover:text-ink"}`}
        aria-pressed={text.bookmarked}
      >
        <BookmarkIcon filled={text.bookmarked} className="size-4" /> {text.bookmarked ? "Saved" : "Save"}
      </button>
    </>
  );
}
