"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe } from "@/components/me-context";
import { Flashcard, GoalBar } from "@/components/review/review-parts";
import { useReviewSession } from "@/components/review/use-review-session";
import { FlashcardBone, GoalBarBone } from "@/components/skeletons/pages";
import { SectionLoading } from "@/components/skeletons/parts";
import { Button, Empty, FailureNote, PageHeader, UpgradeNote } from "@/components/ui";
import { languageName } from "@/lib/languages";
import { HOME } from "@/lib/nav";

function CaughtUp({ ahead, onPractiseAhead }: { ahead: boolean; onPractiseAhead: () => void }) {
  // Where the card would be: Review's tour points here when nothing is due.
  return (
    <div data-tour="review-card">
      <Empty title={ahead ? "Nothing left to practise" : "All caught up!"}>
        <p>{ahead ? "You've reviewed everything you're learning." : "No cards are due right now."}</p>
        <div className="mt-3 flex justify-center gap-2">
          {!ahead && <Button variant="secondary" onClick={onPractiseAhead}>Practise ahead</Button>}
          <Link href={HOME} className="rounded-lg bg-accent px-3.5 py-2 text-sm text-accent-ink">Read something new</Link>
        </div>
      </Empty>
    </div>
  );
}

function ReviewSession() {
  const { me } = useMe();
  const language = me.targetLanguage ?? "";
  const [ahead, setAhead] = useState(false);
  const session = useReviewSession(language, ahead);
  const { queue, card } = session;
  const loading = !queue && !session.error;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Review"
        subtitle={language ? `${languageName(language)} words due today` : "Words due today in all your languages"}
      />
      {session.stats && <GoalBar stats={session.stats} />}
      <FailureNote error={session.error} />
      {loading && <SectionLoading label="cards">{!session.stats && <GoalBarBone />}<FlashcardBone /></SectionLoading>}
      {queue && !card && <CaughtUp ahead={ahead} onPractiseAhead={() => setAhead(true)} />}
      {card && (
        <Flashcard card={card} remaining={queue!.length} revealed={session.revealed} busy={session.busy} onReveal={session.reveal} onRate={session.rate} />
      )}
      <p className="mt-4 text-center text-xs text-muted">
        Words graduate to “known” once their review interval passes 90 days. Reviewing as {me.displayName}.
      </p>
    </div>
  );
}

export default function ReviewPage() {
  const { isPro } = useMe();
  if (isPro) return <ReviewSession />;
  return (
    <div>
      <PageHeader title="Review" />
      <UpgradeNote message="Spaced-repetition review is part of Pro. Your saved words are kept either way — upgrade any time to start reviewing them." />
    </div>
  );
}
