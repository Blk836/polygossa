import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { cognitoConfig } from "@/lib/cognito";
import { HOME } from "@/lib/nav";
import { clearSession, keepSessionFresh, writeSession } from "@/lib/session";

const TOKEN_COOKIE = "lector_token";
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const PUBLIC_PATHS = ["/", "/login", "/signup"];
const LEGAL_PAGES = ["/privacy", "/terms"];
const AUTH_PAGES = ["/login", "/signup"];
const LANDING = "/";

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
    if (AUTH_PAGES.includes(pathname)) return NextResponse.next();
    return (AUTO_LOGIN && (await autoLogin(request))) || signedOut(request);
  }
  if (AUTH_PAGES.includes(pathname)) return NextResponse.redirect(new URL(HOME, request.url));
  return renewed(request);
}

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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|opengraph-image|.*\\.(?:svg|png|jpg|ico|webmanifest)$).*)"],
};
