import { NeutralSkeleton } from "@/components/skeletons/pages";

// Shown the moment a link is clicked, while the page comes from the server; it is also what lets Next.js prefetch the
// app's pages, so a click switches at once (docs/acceptance/instant-tabs.feature). Pages with their own outline
// (page-skeletons.feature) have their own loading.tsx; the rest get this one, which shows no title.
export default function Loading() {
  return <NeutralSkeleton />;
}
