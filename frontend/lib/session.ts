import { ACCESS_COOKIE, REFRESH_COOKIE, needsRenewal, renew, type CognitoConfig, type Tokens } from "./cognito";

interface CookieJar {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: object): unknown;
  delete(name: string): unknown;
}

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

export async function keepSessionFresh(
  config: CognitoConfig | null,
  jar: Pick<CookieJar, "get">,
): Promise<Tokens | "fresh" | "ended"> {
  const refresh = jar.get(REFRESH_COOKIE)?.value;
  if (!config || !refresh) return "fresh";
  if (!needsRenewal(jar.get(ACCESS_COOKIE)?.value, Math.floor(Date.now() / 1000))) return "fresh";
  return (await renew(config, refresh)) ?? "ended";
}

export async function currentAccess(config: CognitoConfig | null, jar: CookieJar): Promise<string | undefined> {
  const session = await keepSessionFresh(config, jar);
  if (session === "ended") return undefined;
  if (session === "fresh") return jar.get(ACCESS_COOKIE)?.value;
  writeSession(jar, session);
  return session.access;
}
