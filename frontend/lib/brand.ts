// The product name people see. Set BRAND_NAME (read by the backend too) to rename the app; next.config.ts inlines it
// at build time, so restart `npm run dev` or rebuild after changing it.
export const DEFAULT_BRAND = "Polygossa";

/** The configured name, or the default when unset or blank. */
export function brandName(configured: string | undefined): string {
  return (configured ?? "").trim() || DEFAULT_BRAND;
}

export const BRAND = brandName(process.env.BRAND_NAME);
