import { HOME } from "./nav";
import { appUrl } from "./site";

export interface CognitoConfig {
  domain: string;
  clientId: string;
  appUrl: string;
}

export interface Tokens {
  access: string;
  id: string;
  refresh?: string;
}

export interface PendingLogin {
  state: string;
  verifier: string;
  next: string;
}

export const ACCESS_COOKIE = "lector_token";
export const REFRESH_COOKIE = "lector_refresh";
export const LOGIN_COOKIE = "lector_login";
const RENEW_BEFORE_SECONDS = 60;

export function cognitoConfig(env: Record<string, string | undefined> = process.env): CognitoConfig | null {
  const domain = env.COGNITO_DOMAIN?.trim().replace(/\/+$/, "");
  const clientId = env.COGNITO_CLIENT_ID?.trim();
  if (!domain || !clientId) return null;
  return { domain, clientId, appUrl: appUrl(env) };
}

export function redirectUri(config: CognitoConfig): string {
  return `${config.appUrl}/api/auth/callback`;
}

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return HOME;
  return next;
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomString(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export async function startLogin(config: CognitoConfig, screen: "login" | "signup", next: string | null) {
  const pending: PendingLogin = { state: randomString(), verifier: randomString(), next: safeNext(next) };
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: redirectUri(config),
    scope: "openid email aws.cognito.signin.user.admin",
    state: pending.state,
    code_challenge: await challengeFor(pending.verifier),
    code_challenge_method: "S256",
  });
  const page = screen === "signup" ? "signup" : "oauth2/authorize";
  return { pending, url: `${config.domain}/${page}?${params}` };
}

export function encodePending(pending: PendingLogin): string {
  return JSON.stringify(pending);
}

export function decodePending(value: string | undefined): PendingLogin | null {
  if (!value) return null;
  try {
    const p = JSON.parse(value) as Partial<PendingLogin>;
    return typeof p.state === "string" && typeof p.verifier === "string" && typeof p.next === "string"
      ? { state: p.state, verifier: p.verifier, next: safeNext(p.next) }
      : null;
  } catch {
    return null;
  }
}

async function tokenRequest(config: CognitoConfig, form: Record<string, string>): Promise<Tokens | null> {
  try {
    const res = await fetch(`${config.domain}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, ...form }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; id_token?: string; refresh_token?: string };
    if (!data.access_token || !data.id_token) return null;
    return { access: data.access_token, id: data.id_token, refresh: data.refresh_token };
  } catch {
    return null;
  }
}

export function exchangeCode(config: CognitoConfig, code: string, verifier: string): Promise<Tokens | null> {
  return tokenRequest(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(config),
    code_verifier: verifier,
  });
}

export async function renew(config: CognitoConfig, refresh: string): Promise<Tokens | null> {
  const tokens = await tokenRequest(config, { grant_type: "refresh_token", refresh_token: refresh });
  return tokens && { ...tokens, refresh: tokens.refresh ?? refresh };
}

export async function revoke(config: CognitoConfig, refresh: string): Promise<void> {
  try {
    await fetch(`${config.domain}/oauth2/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refresh, client_id: config.clientId }),
      cache: "no-store",
    });
  } catch {
  }
}

export function logoutUrl(config: CognitoConfig): string {
  const params = new URLSearchParams({ client_id: config.clientId, logout_uri: `${config.appUrl}/` });
  return `${config.domain}/logout?${params}`;
}

export function expiresAt(token: string): number | null {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === "number" ? exp : null;
  } catch {
    return null;
  }
}

export function needsRenewal(access: string | undefined, nowSeconds: number): boolean {
  if (!access) return true;
  const exp = expiresAt(access);
  return exp === null || exp - nowSeconds < RENEW_BEFORE_SECONDS;
}
