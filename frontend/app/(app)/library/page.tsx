import { LibraryView } from "@/components/library/library-view";
import { sourceFromParam } from "@/lib/library-filters";

/** My library: your imports and saved items; `?source=saved` (or `imported`) starts filtered. */
export default async function LibraryPage({ searchParams }: PageProps<"/library">) {
  return <LibraryView source={sourceFromParam((await searchParams).source)} />;
}
