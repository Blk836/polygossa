/** This site's public address (APP_URL, set on the live site), without a trailing slash; the dev server otherwise. */
export function appUrl(env: Record<string, string | undefined>): string {
  return (env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}
