"use client";

import { useCardLayout } from "../card-layout-context";
import { Bone, ButtonBone, CardGridBone, LayoutPickerBone, PageLoading, SectionLoading, ShelfBone, SkeletonHeader } from "./parts";

function ExploreToolbarBone() {
  return (
    <div data-skeleton="toolbar" className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center">
      <Bone className="h-[2.375rem] flex-1 rounded-lg" />
      <div className="flex gap-2">
        <Bone className="h-[2.375rem] w-28 rounded-xl" />
        <Bone className="h-[2.625rem] w-56 rounded-lg" />
      </div>
    </div>
  );
}

function CategoryChipsBone() {
  return (
    <div data-skeleton="chips" className="mb-7 flex gap-2 overflow-hidden sm:flex-wrap">
      {["w-14", "w-20", "w-16", "w-24", "w-[4.5rem]", "w-20", "w-16"].map((w, i) => (
        <Bone key={i} className={`h-[2.125rem] shrink-0 rounded-full ${w}`} />
      ))}
    </div>
  );
}

export function ExploreShelvesLoading() {
  const { layout } = useCardLayout();
  return (
    <SectionLoading label="shelves">
      <ShelfBone layout={layout} />
      <ShelfBone layout={layout} />
    </SectionLoading>
  );
}

export function CardsLoading({ label }: { label: string }) {
  const { layout } = useCardLayout();
  return <SectionLoading label={label}><CardGridBone layout={layout} /></SectionLoading>;
}

export function ExploreSkeleton() {
  const { layout } = useCardLayout();
  return (
    <PageLoading label="Explore">
      <SkeletonHeader title="Explore" actions={<LayoutPickerBone />} />
      <ExploreToolbarBone />
      <CategoryChipsBone />
      <ShelfBone layout={layout} />
      <ShelfBone layout={layout} />
    </PageLoading>
  );
}

export function LibrarySkeleton() {
  const { layout } = useCardLayout();
  return (
    <PageLoading label="My library">
      <SkeletonHeader title="My library" actions={<><LayoutPickerBone /><ButtonBone className="h-[2.625rem] w-[5.25rem]" /><ButtonBone className="h-[2.625rem] w-[5.25rem]" /></>} />
      <div data-skeleton="filters" className="mb-4 flex items-start justify-end gap-2">
        <Bone className="h-[2.125rem] w-[5.75rem] rounded-full" />
      </div>
      <CardGridBone layout={layout} />
    </PageLoading>
  );
}

export function PlaylistsSkeleton() {
  const { layout } = useCardLayout();
  return (
    <PageLoading label="Playlists">
      <SkeletonHeader title="Playlists" actions={<LayoutPickerBone />} />
      <div data-skeleton="create" className="mb-6 flex flex-col gap-2 rounded-xl border border-line bg-card p-3 sm:flex-row">
        <Bone className="h-[2.375rem] flex-1 rounded-lg" />
        <Bone className="h-[2.375rem] rounded-xl sm:w-40" />
        <ButtonBone className="w-32" />
      </div>
      <CardGridBone layout={layout} count={6} />
    </PageLoading>
  );
}
