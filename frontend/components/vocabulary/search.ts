// Vocabulary list filters and the query strings built from them.

export const PAGE_SIZE = 50;

export interface Filters {
  language: string;
  status: string;
  kind: string;
  sort: string;
  query: string;
  /** Only words carrying this tag; "" for all. */
  tag: string;
  page: number;
}

/** Query string for GET /api/vocabulary; empty filters are left out. */
export function searchParams(f: Filters): URLSearchParams {
  const params = new URLSearchParams({ sort: f.sort, page: String(f.page), size: String(PAGE_SIZE) });
  const optional: [string, string][] = [["language", f.language], ["status", f.status], ["kind", f.kind], ["q", f.query], ["tag", f.tag]];
  for (const [key, value] of optional) if (value) params.set(key, value);
  return params;
}

/** Export links honour the language and status filters only. */
export function exportParams(f: Pick<Filters, "language" | "status">): URLSearchParams {
  const params = new URLSearchParams();
  if (f.language) params.set("language", f.language);
  if (f.status) params.set("status", f.status);
  return params;
}

/** Tags typed into the editor ("Animals, pets food"): split on commas and spaces, lower-cased, duplicates dropped. */
export function parseTags(input: string): string[] {
  return [...new Set(input.split(/[\s,]+/).map((t) => t.toLowerCase()).filter(Boolean))];
}

export function pageCount(total: number): number {
  return Math.ceil(total / PAGE_SIZE);
}

/** The status filter the page opens on: one named in the address ("?status=known"), else learning words. */
export function initialStatus(param: string | null): string {
  return param === "known" || param === "ignored" ? param : "learning";
}
