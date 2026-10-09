import { Bone, ButtonBone, CardFrame, PageLoading, RowsBone, SectionLoading, SkeletonHeader } from "./parts";

// Outlines of the app's other pages, each laid out like its page (docs/acceptance/page-skeletons.feature).

/** Review's daily goal bar: the ring, two lines and the streak. */
export function GoalBarBone() {
  return (
    <div data-skeleton="goal" className="mb-6 flex items-center gap-4 rounded-xl border border-line bg-card p-4">
      <Bone className="size-14 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2">
        <Bone className="h-4 w-48 max-w-full" />
        <Bone className="h-3.5 w-64 max-w-full" />
      </div>
      <Bone className="h-7 w-10" />
    </div>
  );
}

/** One flashcard, its word in the middle and the answer buttons under it. */
export function FlashcardBone() {
  return (
    <div data-skeleton="flashcard" className="rounded-2xl border border-line bg-card shadow-sm">
      <div className="flex justify-between border-b border-line px-5 py-2"><Bone className="h-3 w-16" /><Bone className="h-3 w-10" /></div>
      <div className="flex min-h-64 flex-col items-center justify-center gap-4 p-8">
        <Bone className="h-9 w-48" />
        <Bone className="h-4 w-64 max-w-full" />
        <ButtonBone className="mt-4 w-40" />
      </div>
    </div>
  );
}

export function ReviewSkeleton() {
  return (
    <PageLoading label="Review" className="mx-auto max-w-2xl">
      <SkeletonHeader title="Review" />
      <GoalBarBone />
      <FlashcardBone />
    </PageLoading>
  );
}

/** The Words list's rows: term, meaning and context, like EntryRow. */
export function WordRowsBone({ count = 6 }: { count?: number }) {
  return (
    <div data-skeleton="rows">
      <Bone className="mb-3 h-5 w-32" />
      <ul className="space-y-3">
        {Array.from({ length: count }, (_, i) => (
          <li key={i} className="space-y-2 rounded-xl border border-line bg-card p-4">
            <Bone className="h-6 w-32" />
            <Bone className={`h-4 ${i % 2 ? "w-2/3" : "w-1/2"}`} />
            <Bone className="h-3.5 w-3/4" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VocabularySkeleton() {
  return (
    <PageLoading label="Words">
      <SkeletonHeader title="Vocabulary" actions={<><ButtonBone className="h-[2.375rem] w-28" /><ButtonBone className="h-[2.375rem] w-28" /><ButtonBone className="h-[2.375rem] w-32" /></>} />
      <div data-skeleton="switch" className="mb-4 flex gap-1 rounded-lg border border-line bg-card p-1 sm:w-fit">
        <Bone className="h-[1.875rem] w-24" /><Bone className="h-[1.875rem] w-28" />
      </div>
      <div data-skeleton="filters" className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Bone className="h-[2.375rem] rounded-lg" />
        {[0, 1, 2].map((i) => <Bone key={i} className="h-[2.375rem] rounded-xl sm:w-32" />)}
      </div>
      <WordRowsBone />
    </PageLoading>
  );
}

export function WritingSkeleton() {
  return (
    <PageLoading label="Write" className="mx-auto max-w-3xl">
      <SkeletonHeader title="Writing" />
      <div data-skeleton="start" className="rounded-xl border border-line bg-card p-5">
        <Bone className="h-7 w-56" />
        <div className="mt-3 space-y-2">{[0, 1, 2].map((i) => <Bone key={i} className="h-3.5 w-3/4" />)}</div>
        <div className="mt-4 flex gap-3"><Bone className="h-9 w-48 rounded-lg" /><ButtonBone className="w-28" /></div>
      </div>
      <div className="mt-8">
        <Bone className="mb-3 h-6 w-28" />
        <RowsBone count={3} lead />
      </div>
    </PageLoading>
  );
}

/** The Progress page below its header, laid out like the real cards. */
export function ProgressSkeleton() {
  return (
    <PageLoading label="Progress">
      <SkeletonHeader title="Progress" actions={<Bone part="picker" className="h-[2.375rem] w-36 rounded-xl" />} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <CardFrame part="streak" className="self-start lg:col-span-2">
          <div className="flex items-center gap-4"><Bone className="size-11 rounded-full" /><div className="space-y-2"><Bone className="h-8 w-40" /><Bone className="h-3.5 w-72 max-w-full" /></div></div>
          <div className="mt-5 flex justify-around">{Array.from({ length: 7 }, (_, i) => <Bone key={i} className="size-8 rounded-full" />)}</div>
          <div className="mt-6 flex items-center justify-between border-t border-line pt-4"><Bone className="h-4 w-32" /><ButtonBone className="w-36" /></div>
        </CardFrame>
        <div className="grid content-start gap-4">
          <CardFrame part="goal"><Bone className="h-6 w-32" /><Bone className="mt-3 h-3.5 w-24" /><Bone className="mt-3 h-2 w-full rounded-full" /></CardFrame>
          <CardFrame part="milestone"><Bone className="h-3.5 w-36" /><Bone className="mt-3 h-10 w-12" /><Bone className="mt-4 h-2 w-full rounded-full" /><Bone className="mt-3 h-4 w-40" /></CardFrame>
        </div>
      </div>
      <div data-skeleton="wide" className="mt-4 space-y-4">
        <CardFrame>
          <Bone className="h-6 w-48" />
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{[0, 1, 2].map((i) => <Bone key={i} className="h-36 rounded-lg" />)}</div>
        </CardFrame>
        <CardFrame>
          <Bone className="h-6 w-40" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => <Bone key={i} className="h-24 rounded-lg" />)}
          </div>
        </CardFrame>
        <CardFrame>
          <Bone className="h-6 w-28" />
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="h-24 rounded-lg" />)}</div>
        </CardFrame>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CardFrame><Bone className="h-6 w-32" /><Bone className="mt-4 h-40 rounded-lg" /></CardFrame>
          <CardFrame><Bone className="h-6 w-48" /><Bone className="mt-4 h-40 rounded-lg" /></CardFrame>
        </div>
      </div>
    </PageLoading>
  );
}

export function ForumThreadsLoading() {
  return <SectionLoading label="threads"><RowsBone count={6} /></SectionLoading>;
}

export function ForumSkeleton() {
  return (
    <PageLoading label="Forum">
      <SkeletonHeader title="Forum" actions={<ButtonBone className="w-28" />} />
      <div data-skeleton="tabs" className="mb-4 flex gap-1 overflow-hidden rounded-lg border border-line bg-card p-1 sm:w-fit">
        {["w-10", "w-24", "w-20", "w-24", "w-16"].map((w, i) => <Bone key={i} className={`h-[1.875rem] shrink-0 ${w}`} />)}
      </div>
      <RowsBone count={6} />
    </PageLoading>
  );
}

export function ClassesSkeleton() {
  return (
    <PageLoading label="Classes">
      <SkeletonHeader title="Classes" />
      <div data-skeleton="forms" className="mt-4 grid gap-4 md:grid-cols-2">
        <Bone className="h-48 rounded-xl" />
        <Bone className="h-48 rounded-xl" />
      </div>
      <RowsBone count={3} className="mt-8" />
    </PageLoading>
  );
}

export function ImportSkeleton() {
  return (
    <PageLoading label="Import">
      <SkeletonHeader title="Import" />
      <div data-skeleton="form" className="max-w-2xl space-y-5">
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-card p-1 sm:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => <Bone key={i} className="h-8" />)}
        </div>
        <Bone className="h-4 w-2/3" />
        <div className="grid gap-4 sm:grid-cols-[1fr_200px]"><Bone className="h-16 rounded-lg" /><Bone className="h-16 rounded-lg" /></div>
        <Bone className="h-56 rounded-lg" />
        <ButtonBone className="w-32" />
      </div>
    </PageLoading>
  );
}

/** A lesson: the reader's top (back link, title, stats bar), then lines of text at the lesson's width. */
export function ReaderSkeleton() {
  return (
    <PageLoading label="lesson" className="mx-auto max-w-3xl">
      <div className="mb-4">
        <p className="text-sm text-muted">← Library</p>
        <Bone className="mt-2 h-9 w-2/3" />
        <Bone className="mt-2 h-4 w-48" />
        <div className="mt-3 flex items-center gap-4 rounded-xl border border-line bg-card p-3">
          <Bone className="h-4 w-40" /><Bone className="h-4 w-32" /><Bone className="ml-auto h-7 w-28" />
        </div>
      </div>
      <div data-skeleton="text" className="space-y-4 pt-4">
        {Array.from({ length: 12 }, (_, i) => <Bone key={i} className={`h-5 ${i % 4 === 3 ? "w-3/5" : "w-full"}`} />)}
      </div>
    </PageLoading>
  );
}

/** A Settings tab's content (the Settings title and tabs stay on screen around it). */
export function SettingsSkeleton({ label }: { label: string }) {
  return (
    <PageLoading label={label} className="space-y-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3 rounded-xl border border-line bg-card p-5">
          <Bone className="h-6 w-40" />
          <Bone className="h-[2.375rem] w-full rounded-lg" />
          <Bone className="h-3.5 w-2/3" />
        </div>
      ))}
    </PageLoading>
  );
}

/** For pages without an outline of their own: content shapes and no title. */
export function NeutralSkeleton() {
  return (
    <PageLoading>
      <Bone className="mb-6 h-9 w-56" />
      <div className="space-y-4">
        <Bone className="h-32 rounded-xl" />
        <Bone className="h-48 rounded-xl" />
      </div>
    </PageLoading>
  );
}
