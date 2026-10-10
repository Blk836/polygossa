import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LOGIN_COOKIE, cognitoConfig, encodePending, startLogin } from "@/lib/cognito";
import { sessionCookieOptions } from "@/lib/session";

export async function GET(request: NextRequest) {
  const config = cognitoConfig();
  if (!config) return NextResponse.redirect(new URL("/login", request.url));
  const screen = request.nextUrl.searchParams.get("screen") === "signup" ? "signup" : "login";
  const { pending, url } = await startLogin(config, screen, request.nextUrl.searchParams.get("next"));
  const response = NextResponse.redirect(url);
  response.cookies.set(LOGIN_COOKIE, encodePending(pending), sessionCookieOptions(60 * 10));
  return response;
}
