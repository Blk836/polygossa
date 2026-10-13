"use client";

import { Named } from "@/components/avatar";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { CardLayout } from "@/lib/card-layout";
import { difficulty, readingProgress, type DifficultyBand } from "@/lib/card-status";
import { categoryLabel } from "@/lib/categories";
import { formatVideoLength } from "@/lib/media";
import type { TextSummary } from "@/lib/types";
import { CheckIcon, HeadphonesIcon, VideoIcon } from "./icons";
import { LevelBadge } from "./ui";

const COVER_LETTER: Record<CardLayout, string> = { cards: "text-6xl", compact: "text-4xl", list: "text-3xl" };
const COVER_SIZES: Record<CardLayout, string> = {
  cards: "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw",
  compact: "(min-width: 1024px) 20vw, (min-width: 640px) 33vw, 50vw",
  list: "144px",
};
const TITLE: Record<CardLayout, string> = {
  cards: "line-clamp-2 text-[17px]",
  compact: "line-clamp-2 text-[15px]",
  list: "line-clamp-1 text-[15px]",
};

function Cover({ text, layout, href, onOpen, className = "" }: { text: TextSummary; layout: CardLayout; href: string; onOpen?: () => void; className?: string }) {
  const length = formatVideoLength(text.video?.durationSeconds);
  return (
    <div data-cover className={`relative aspect-[16/9] overflow-hidden ${className}`}>
      <Link href={href} onClick={onOpen} tabIndex={-1} aria-hidden className={`absolute inset-0 block ${text.video ? "bg-line" : `cover cover-${text.category}`}`}>
        {text.video ? (
          <Image src={text.video.thumbnailUrl} alt="" fill sizes={COVER_SIZES[layout]} className="object-cover transition duration-300 group-hover:scale-[1.03]" />
        ) : (
          <span className={`absolute inset-0 flex items-center justify-center font-display ${COVER_LETTER[layout]} font-semibold text-ink/80 select-none`} lang={text.language}>
            {[...text.title.trim()][0] ?? "·"}
          </span>
        )}
        <span className={`absolute rounded bg-card shadow-sm ${layout === "list" ? "top-1 left-1" : "top-2 left-2"}`}><LevelBadge level={text.cefrLevel} /></span>
        {length && (
          <span className="absolute right-2 bottom-2 flex items-center gap-1 rounded bg-black/75 px-1.5 py-0.5 text-xs font-medium text-white tabular-nums">
            <VideoIcon className="size-3.5" />{length}
          </span>
        )}
      </Link>
      <Progress text={text} layout={layout} />
    </div>
  );
}

function Progress({ text, layout }: { text: TextSummary; layout: CardLayout }) {
  const p = readingProgress(text.progress);
  if (!p) return null;
  if (p.finished) {
    return (
      <span className={`absolute flex items-center gap-0.5 rounded bg-good-soft px-1.5 py-0.5 text-[11px] font-semibold text-good shadow-sm ${layout === "list" ? "top-1 right-1" : "top-2 right-2"}`}>
        <CheckIcon className="size-3.5" aria-hidden />Finished
      </span>
    );
  }
  return (
    <div
      role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={p.percent} aria-valuetext={p.label}
      title={p.label} className="absolute inset-x-0 bottom-0 h-1 bg-ink/25"
    >
      <div className="h-full bg-rubric" style={{ width: `${Math.max(p.percent, 3)}%` }} />
    </div>
  );
}

const BAND_TONES: Record<DifficultyBand, string> = {
  easy: "bg-good-soft text-good",
  stretch: "bg-warn-soft text-warn",
  hard: "bg-bad-soft text-bad",
};

function DifficultyChip({ text }: { text: TextSummary }) {
  const d = difficulty(text.stats);
  if (!d) return null;
  return (
    <p data-testid="difficulty" title={d.title} className="flex flex-wrap items-center gap-1.5 text-xs">
      <span className="rounded px-1.5 py-0.5 font-semibold text-ink tabular-nums" style={{ background: "var(--w-new)" }}>{d.text}</span>
      <span className={`rounded px-1.5 py-0.5 font-semibold ${BAND_TONES[d.band]}`}>{d.label}</span>
    </p>
  );
}

function Meta({ text }: { text: TextSummary }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide whitespace-nowrap text-muted uppercase">
      <span className="truncate text-rubric">{categoryLabel(text.category)}</span>
      <span aria-hidden>·</span>
      <span>{text.kind === "video" ? "Video" : `${text.wordCount.toLocaleString()} words`}</span>
      {text.hasAudio && <HeadphonesIcon className="size-3.5 shrink-0" aria-label="Has audio" />}
      {text.isPublic && text.mine && <span className="ml-auto rounded bg-accent-soft px-1.5 py-0.5 tracking-normal text-ink normal-case">Shared</span>}
    </p>
  );
}

function Title({ text, layout, href, onOpen }: { text: TextSummary; layout: CardLayout; href: string; onOpen?: () => void }) {
  return (
    <Link href={href} onClick={onOpen} className={`${TITLE[layout]} font-reading leading-snug font-semibold group-hover:text-accent`} lang={text.language}>
      {text.title}
    </Link>
  );
}

const Owner = ({ text }: { text: TextSummary }) => <p className="-mt-1 truncate text-xs text-muted">by <Named name={text.owner.displayName} photoUrl={text.owner.photoUrl} /></p>;

const ReasonLine = ({ reason }: { reason?: string }) =>
  reason ? <p data-testid="reason" className="truncate text-xs font-medium text-accent">{reason}</p> : null;

interface CardProps {
  text: TextSummary;
  actions?: ReactNode;
  showOwner?: boolean;
  layout?: CardLayout;
  className?: string;
  href?: string;
  reason?: string;
  onOpen?: () => void;
}

export function TextCard({ text, actions, showOwner, layout = "cards", className = "", href = `/read/${text.id}`, reason, onOpen }: CardProps) {
  if (layout === "list") return <TextRow text={text} actions={actions} showOwner={showOwner} className={className} href={href} reason={reason} onOpen={onOpen} />;
  const compact = layout === "compact";
  return (
    <article className={`group flex flex-col overflow-hidden rounded-xl border border-line bg-card transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md ${className}`}>
      <Cover text={text} layout={layout} href={href} onOpen={onOpen} />
      <div className={`flex flex-1 flex-col ${compact ? "gap-1.5 p-2.5" : "gap-2 p-3.5"}`}>
        <Meta text={text} />
        <Title text={text} layout={layout} href={href} onOpen={onOpen} />
        {showOwner && <Owner text={text} />}
        <ReasonLine reason={reason} />
        <div className="mt-auto space-y-2 pt-1">
          <DifficultyChip text={text} />
          {actions && <div className="flex flex-wrap items-center gap-1 border-t border-line pt-2">{actions}</div>}
        </div>
      </div>
    </article>
  );
}

function TextRow({ text, actions, showOwner, className, href, reason, onOpen }: Omit<CardProps, "layout" | "href"> & { href: string }) {
  return (
    <article className={`group @container rounded-xl border border-line bg-card transition hover:border-accent/40 hover:shadow-sm ${className}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-2 @xl:flex-nowrap @xl:pr-3">
        <Cover text={text} layout="list" href={href} onOpen={onOpen} className="w-28 shrink-0 rounded-lg @xl:w-36" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Meta text={text} />
          <Title text={text} layout="list" href={href} onOpen={onOpen} />
          {showOwner && <Owner text={text} />}
          <ReasonLine reason={reason} />
          <div className="max-w-xs"><DifficultyChip text={text} /></div>
        </div>
        {actions && (
          <div className="flex basis-full flex-wrap items-center gap-1 border-t border-line pt-2 @xl:basis-auto @xl:flex-nowrap @xl:justify-end @xl:border-0 @xl:pt-0">
            {actions}
          </div>
        )}
      </div>
    </article>
  );
}
