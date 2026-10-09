export function appUrl(env: Record<string, string | undefined>): string {
  return (env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");
}
