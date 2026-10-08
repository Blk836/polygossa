import { ACCESS_COOKIE, REFRESH_COOKIE, needsRenewal, renew, type CognitoConfig, type Tokens } from "./cognito";

/** The parts of Next's request and response cookie stores the session uses. */
interface CookieJar {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: object): unknown;
  delete(name: string): unknown;
}

/** A Cognito session lasts as long as its refresh token (30 days); each access token, an hour. */
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export function sessionCookieOptions(maxAge = SESSION_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function writeSession(jar: CookieJar, tokens: Tokens): void {
  jar.set(ACCESS_COOKIE, tokens.access, sessionCookieOptions());
  if (tokens.refresh) jar.set(REFRESH_COOKIE, tokens.refresh, sessionCookieOptions());
}

export function clearSession(jar: CookieJar): void {
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

/**
 * Renews a Cognito session whose access token is about to expire: the new tokens, "fresh" when nothing needed doing
 * (or it isn't a Cognito session: the test account's, or none), or "ended" when Cognito refused the refresh token.
 */
export async function keepSessionFresh(
  config: CognitoConfig | null,
  jar: Pick<CookieJar, "get">,
): Promise<Tokens | "fresh" | "ended"> {
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!config || !refresh) return "fresh";
  if (!needsRenewal(jar.get(ACCESS_COOKIE)?.value, Math.floor(Date.now() / 1000))) return "fresh";
  return (await renew(config, refresh)) ?? "ended";
}
