export const DEFAULT_BRAND = "Polygossa";

export function brandName(configured: string | undefined): string {
  return (configured ?? "").trim() || DEFAULT_BRAND;
}

export const BRAND = brandName(process.env.BRAND_NAME);
