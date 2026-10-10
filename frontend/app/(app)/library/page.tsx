import { LibraryView } from "@/components/library/library-view";
import { sourceFromParam } from "@/lib/library-filters";

export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  return <LibraryView source={sourceFromParam((await searchParams).source)} />;
}
