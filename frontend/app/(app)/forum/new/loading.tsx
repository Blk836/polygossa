import { NeutralSkeleton } from "@/components/skeletons/pages";

// Not the parent page's outline: that would show the wrong title.
export default function Loading() {
  return <NeutralSkeleton />;
}
