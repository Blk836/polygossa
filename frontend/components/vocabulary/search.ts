export const PAGE_SIZE = 50;

export interface Filters {
  language: string;
  status: string;
  kind: string;
  sort: string;
  query: string;
  tag: string;
  page: number;
}

export function searchParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams({ sort: f.sort, page: String(f.page), size: String(PAGE_SIZE) });
  const optional: [string, string][] = [["language", f.language], ["status", f.status], ["kind", f.kind], ["q", f.query], ["tag", f.tag]];
  for (const [key, value] of optional) if (value) params.set(key, value);
  return params;
}

export const EXPORT_TOPS = [50, 100, 200, 500] as const;

export function exportParams(f: Pick<Filters, "language" | "status"> & Partial<Pick<Filters, "sort">>, top?: number): URLSearchParams {
  const params = new URLSearchParams();
  if (f.language) params.set("language", f.language);
  if (f.status) params.set("status", f.status);
  if (f.sort === "met") {
    params.set("sort", "met");
    if (top) params.set("limit", String(top));
  }
  return params;
}

export function sortForKind(sort: string, kind: string): string {
  return kind === "phrase" && sort === "met" ? "recent" : sort;
}

export function parseTags(input: string): string[] {
  return [...new Set(input.split(/[\s,]+/).map((t) => t.toLowerCase()).filter(Boolean))];
}

export function pageCount(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

export function initialStatus(param: string | null): string {
  return param === "known" || param === "ignored" ? param : "learning";
}
