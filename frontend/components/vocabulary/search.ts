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

export function exportParams(f: Pick<Filters, "language" | "status">): URLSearchParams {
  const params = new URLSearchParams();
  if (f.language) params.set("language", f.language);
  if (f.status) params.set("status", f.status);
  return params;
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
