"use client";

import Link from "next/link";
import { languageInfo } from "@/lib/languages";
import { canSpeak, speak } from "@/lib/speech";
import type { ReviewCard, ReviewStats } from "@/lib/types";
import { FlameIcon, SpeakerIcon } from "../icons";
import { Button } from "../ui";
import type { Rating } from "./use-review-session";

const RATINGS: { rating: Rating; label: string; key: string; className: string }[] = [
  { rating: "forgot", label: "Forgot", key: "1", className: "border-bad/40 text-bad" },
  { rating: "hard", label: "Hard", key: "2", className: "border-warn/40 text-warn" },
  { rating: "easy", label: "Easy", key: "3", className: "border-good/40 text-good" },
];

function GoalRing({ done, goal }: { done: number; goal: number }) {
  const pct = Math.min(1, goal ? done / goal : 0);
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 56 56" className="size-14" aria-label={`${done} of ${goal} reviews today`}>
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 28 28)" />
      <text x="28" y="32" textAnchor="middle" fontSize="12" fontWeight="600" fill="var(--ink)">{done}</text>
    </svg>
  );
}

export function GoalBar({ stats }: { stats: ReviewStats }) {
  const remaining = Math.max(0, stats.dailyGoal - stats.reviewedToday);
  return (
    <div data-tour="review-goal" className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-card p-4">
      <GoalRing done={stats.reviewedToday} goal={stats.dailyGoal} />
      <div className="flex-1 text-sm">
        <p className="font-medium">{stats.goalMet ? "Daily goal reached!" : `${remaining} more to reach today's goal`}</p>
        <p className="text-muted">
          {stats.dueWords + stats.dueSentences} cards due · goal {stats.dailyGoal}/day (<Link href="/settings" className="underline">change</Link>)
        </p>
      </div>
      <div className="flex items-center gap-1 text-rubric" title="Day streak">
        <FlameIcon className="size-6" />
        <span className="text-xl font-semibold">{stats.streak}</span>
      </div>
    </div>
  );
}

function Meaning({ card }: { card: ReviewCard }) {
  const missingTranslation = card.type === "sentence" && !card.translation;
  return (
    <>
      {card.pronunciation && <p className="text-center text-muted">{card.pronunciation}</p>}
      {card.definition && (
        <p className="text-center text-lg">
          {card.partOfSpeech && <em className="mr-1 text-muted">{card.partOfSpeech}</em>}
          {card.definition}
        </p>
      )}
      {card.translation && <p className="text-center text-lg">{card.translation}</p>}
      {missingTranslation && <p className="text-center text-sm text-muted">No translation saved.</p>}
    </>
  );
}

function Usage({ card }: { card: ReviewCard }) {
  const showExample = card.example && card.example !== card.context;
  return (
    <>
      {card.context && <p className="rounded-lg bg-paper p-3 font-reading" lang={card.language}>{card.context}</p>}
      {showExample && <p className="border-l-2 border-line pl-3 font-reading text-sm italic">{card.example}</p>}
      {card.notes && <p className="text-sm text-muted">{card.notes}</p>}
      {card.sourceTextId && (
        <p className="text-center text-xs text-muted">
          from <Link href={`/read/${card.sourceTextId}`} className="underline">{card.sourceTextTitle}</Link>
        </p>
      )}
    </>
  );
}

function Answer({ card }: { card: ReviewCard }) {
  return (
    <div className="mt-6 space-y-3 text-left">
      <Meaning card={card} />
      <Usage card={card} />
    </div>
  );
}

function RatingButtons({ busy, onRate }: { busy: boolean; onRate: (r: Rating) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {RATINGS.map((r) => (
        <button key={r.rating} onClick={() => onRate(r.rating)} disabled={busy}
          className={`rounded-lg border bg-card py-3 text-sm font-medium hover:bg-paper ${r.className}`}>
          {r.label} <span className="text-xs opacity-60">({r.key})</span>
        </button>
      ))}
    </div>
  );
}

export function Flashcard({ card, remaining, revealed, busy, onReveal, onRate }: {
  card: ReviewCard;
  remaining: number;
  revealed: boolean;
  busy: boolean;
  onReveal: () => void;
  onRate: (r: Rating) => void;
}) {
  const locale = languageInfo(card.language)?.speechLocale ?? card.language;
  const frontSize = card.type === "sentence" ? "text-2xl leading-relaxed" : "text-4xl";
  return (
    <div data-tour="review-card" className="rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-line px-5 py-2 text-xs text-muted">
        <span>{card.type === "sentence" ? "Sentence" : "Word"} · {remaining} left</span>
        {canSpeak() && (
          <button onClick={() => speak(card.front, locale)} aria-label="Pronounce" className="p-1 hover:text-ink"><SpeakerIcon className="size-4" /></button>
        )}
      </div>
      <div className="px-6 py-10 text-center">
        <p className={`font-reading font-semibold ${frontSize}`} lang={card.language}>{card.front}</p>
        {revealed && <Answer card={card} />}
      </div>
      <div className="border-t border-line p-4">
        {revealed ? (
          <RatingButtons busy={busy} onRate={onRate} />
        ) : (
          <Button className="w-full py-3" onClick={onReveal}>Show answer <span className="text-xs opacity-70">(space)</span></Button>
        )}
      </div>
    </div>
  );
}
