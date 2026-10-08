import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cognitoConfig } from "@/lib/cognito";
import { clearSession, keepSessionFresh, writeSession } from "@/lib/session";

const TOKEN_COOKIE = "lector_token";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const PUBLIC_PATHS = ["/", "/login", "/signup"];
/** The legal pages: readable by everyone, signed in or not, and never replaced by an auto-login. */
const LEGAL_PAGES = ["/privacy", "/terms"];
const AUTH_PAGES = ["/login", "/signup"];
/** The landing page: always shown as it is, signed in or not, so auto-login (dev) never hides it. */
const LANDING = "/";

/**
 * Development auto-login: with no session, sign in to the backend's test account and continue (everywhere but the
 * landing, sign-in and sign-up pages, which stay visible). On by default; set AUTO_LOGIN=false to restore the normal login flow. The backend only honours it when app.dev-auto-login is enabled
 * (never in the prod profile), so if it's refused we fall through to the regular login page.
 */
const AUTO_LOGIN = process.env.AUTO_LOGIN !== "false" && !cognitoConfig();

async function devLogin(): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/dev-login`, { method: "POST", cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

/** Signs in to the test account and continues to the requested page. */
async function autoLogin(request: NextRequest): Promise<NextResponse | null> {
  const token = await devLogin();
  if (!token) return null;
  const { pathname, search } = request.nextUrl;
  const response = NextResponse.redirect(new URL(pathname + search, request.url));
  response.cookies.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return response;
}

function signedOut(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();
  const url = new URL("/login", request.url);
  url.searchParams.set("next", pathname + search);
  return NextResponse.redirect(url);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === LANDING || LEGAL_PAGES.includes(pathname)) return NextResponse.next();
  if (!request.cookies.has(TOKEN_COOKIE)) {
    // Like the landing page, the sign-in and sign-up pages stay visible with no session (auth-splash.feature).
    if (AUTH_PAGES.includes(pathname)) return NextResponse.next();
    return (AUTO_LOGIN && (await autoLogin(request))) || signedOut(request);
  }
  if (AUTH_PAGES.includes(pathname)) return NextResponse.redirect(new URL("/library", request.url));
  return renewed(request);
}

/**
 * A Cognito session whose access token is about to expire is renewed here, so the page's server components see the
 * new token (it replaces the old one in the request) and the browser keeps it. If it can't be renewed, sign in again.
 */
async function renewed(request: NextRequest): Promise<NextResponse> {
  const session = await keepSessionFresh(cognitoConfig(), request.cookies);
  if (session === "fresh") return NextResponse.next();
  if (session === "ended") {
    const response = signedOut(request);
    clearSession(response.cookies);
    return response;
  }
  request.cookies.set(TOKEN_COOKIE, session.access);
  const response = NextResponse.next({ request: { headers: request.headers } });
  writeSession(response.cookies, session);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)"],
};
