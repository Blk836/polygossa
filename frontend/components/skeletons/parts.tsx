import type { ReactNode } from "react";
import { cardGridClass, shelfCardLayout, shelfCardWidth, type CardLayout } from "@/lib/card-layout";

// The pieces of the pages' loading outlines (docs/acceptance/page-skeletons.feature): grey shapes sized and spaced
// like the content they stand in for, so a page fills in without moving. `data-skeleton` names each piece.

/** A grey shape; it pulses unless the learner asked for reduced motion. */
export function Bone({ className = "", part }: { className?: string; part?: string }) {
  const rounding = /\brounded/.test(className) ? "" : "rounded-md"; // one rounding class, or Tailwind's order picks
  return <div data-bone data-skeleton={part} className={`${rounding} bg-line motion-safe:animate-pulse ${className}`} />;
}

/** A white card like the page's own (border, padding), holding grey shapes. */
export function CardFrame({ className = "", part, children }: { className?: string; part?: string; children: ReactNode }) {
  return <div data-skeleton={part} className={`rounded-xl border border-line bg-card p-5 ${className}`}>{children}</div>;
}

/**
 * A whole page's outline: one busy region for screen readers ("Loading Explore"), its shapes hidden from them.
 * `label` names the page, or is omitted for the neutral outline.
 */
export function PageLoading({ label = "page", className = "", children }: { label?: string; className?: string; children: ReactNode }) {
  return (
    <div data-testid="page-loading" role="status" aria-busy="true" aria-label={`Loading ${label}`} className={className}>
      <div aria-hidden>{children}</div>
    </div>
  );
}

/** Part of a page still loading its content (the page around it has arrived). */
export function SectionLoading({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div data-testid="section-loading" role="status" aria-busy="true" aria-label={`Loading ${label}`} className={className}>
      <div aria-hidden>{children}</div>
    </div>
  );
}

/** Like PageHeader: the page's real title (styled as its heading), a subtitle line, and its buttons. */
export function SkeletonHeader({ title, subtitle = true, actions }: { title: string; subtitle?: boolean; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-display text-3xl font-semibold tracking-tight">{title}</p>
        {subtitle && <div className="mt-1 flex h-5 items-center"><Bone className="h-3.5 w-72 max-w-[70vw]" /></div>}
      </div>
      {actions && <div data-skeleton="actions" className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** A button-sized shape (`w-*` sets its width). */
export const ButtonBone = ({ className = "w-24" }: { className?: string }) => <Bone className={`h-9 rounded-lg ${className}`} />;

/** The card-layout picker's three icons. */
export const LayoutPickerBone = () => <Bone className="h-[2.625rem] w-[7.25rem] rounded-lg" />;

/** One text card, shaped like TextCard in that layout. */
export function CardBone({ layout, className = "" }: { layout: CardLayout; className?: string }) {
  if (layout === "list") {
    return (
      <div className={`flex items-center gap-3 rounded-xl border border-line bg-card p-2 sm:pr-3 ${className}`}>
        <Bone className="aspect-[16/9] w-28 shrink-0 rounded-lg sm:w-36" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Bone className="h-3 w-24" />
          <Bone className="h-4 w-3/5" />
          <Bone className="h-5 w-full max-w-xs rounded-full" />
        </div>
      </div>
    );
  }
  const compact = layout === "compact";
  return (
    <div className={`flex flex-col overflow-hidden rounded-xl border border-line bg-card ${className}`}>
      <Bone className="aspect-[16/9] rounded-none" />
      <div className={`flex flex-col ${compact ? "gap-1.5 p-2.5" : "gap-2 p-3.5"}`}>
        <Bone className="h-3 w-20" />
        <Bone className={compact ? "h-4 w-4/5" : "h-5 w-4/5"} />
        {!compact && <Bone className="h-3 w-1/3" />}
        <Bone className="mt-1 h-5 w-full rounded-full" />
        <div className="flex gap-1 border-t border-line pt-2">
          <Bone className="h-7 w-14" />
          <Bone className="h-7 w-14" />
        </div>
      </div>
    </div>
  );
}

/** A page of cards in the learner's layout. */
export function CardGridBone({ layout, count = 8 }: { layout: CardLayout; count?: number }) {
  return (
    <div data-skeleton="cards" data-layout={layout} className={cardGridClass(layout)}>
      {Array.from({ length: count }, (_, i) => <CardBone key={i} layout={layout} />)}
    </div>
  );
}

/** A titled, sideways-scrolling row of cards, like Explore's shelves. */
export function ShelfBone({ layout }: { layout: CardLayout }) {
  return (
    <section data-skeleton="shelf" data-layout={layout} className="mb-9">
      <div className="mb-3 space-y-1.5">
        <Bone className="h-6 w-40" />
        <Bone className="h-3.5 w-64 max-w-full" />
      </div>
      <div className="-mx-4 flex gap-4 overflow-hidden px-4 pb-3 sm:mx-0 sm:px-0">
        {Array.from({ length: 5 }, (_, i) => (
          <CardBone key={i} layout={shelfCardLayout(layout)} className={`${shelfCardWidth(layout)} shrink-0`} />
        ))}
      </div>
    </section>
  );
}

/** A bordered list of rows (threads, past tests, classes): `lines` grey lines per row. */
export function RowsBone({ count = 5, className = "", lead = false }: { count?: number; className?: string; lead?: boolean }) {
  return (
    <ul data-skeleton="rows" className={`divide-y divide-line overflow-hidden rounded-xl border border-line bg-card ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="flex items-center gap-4 p-4">
          {lead && <Bone className="h-8 w-12 shrink-0" />}
          <div className="min-w-0 flex-1 space-y-2">
            <Bone className={`h-4 ${i % 2 ? "w-1/2" : "w-2/3"}`} />
            <Bone className="h-3 w-1/3" />
          </div>
          <Bone className="hidden h-3 w-16 shrink-0 sm:block" />
        </li>
      ))}
    </ul>
  );
}
