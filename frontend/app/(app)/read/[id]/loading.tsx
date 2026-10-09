import { DEFAULT_READER_SETTINGS } from "@/components/reader/reader-settings";
import { ReaderSkeleton } from "@/components/skeletons/pages";

// Static, so it is prefetched and shows at once: drawn at the default text width (reading the settings cookie here
// would make it wait for the server).
export default function Loading() {
  return <ReaderSkeleton width={DEFAULT_READER_SETTINGS.width} />;
}
