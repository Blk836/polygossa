import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "lector_token";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const PUBLIC_PATHS = ["/", "/login", "/signup"];
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Development auto-login: with no session, sign in to the backend's test account and continue. On by default; set
 * AUTO_LOGIN=false to restore the normal login flow. The backend only honours it when app.dev-auto-login is enabled
 * (never in the prod profile), so if it's refused we fall through to the regular login page.
 */
const AUTO_LOGIN = process.env.AUTO_LOGIN !== "false";

async function devLogin(): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/dev-login`, { method: "POST", cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

/** Signs in to the test account and continues to the requested page (the app, for public pages). */
async function autoLogin(request: NextRequest): Promise<NextResponse | null> {
  const token = await devLogin();
  if (!token) return null;
  const { pathname, search } = request.nextUrl;
  const target = PUBLIC_PATHS.includes(pathname) ? "/library" : pathname + search;
  const response = NextResponse.redirect(new URL(target, request.url));
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
  if (!request.cookies.has(TOKEN_COOKIE)) {
    return (AUTO_LOGIN && (await autoLogin(request))) || signedOut(request);
  }
  const skipToApp = AUTH_PAGES.includes(pathname) || (AUTO_LOGIN && pathname === "/");
  return skipToApp ? NextResponse.redirect(new URL("/library", request.url)) : NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)"],
};
