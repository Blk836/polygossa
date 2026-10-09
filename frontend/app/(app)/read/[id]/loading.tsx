import { DEFAULT_READER_SETTINGS } from "@/components/reader/reader-settings";
import { ReaderSkeleton } from "@/components/skeletons/pages";

export default function Loading() {
  return <ReaderSkeleton width={DEFAULT_READER_SETTINGS.width} />;
}
