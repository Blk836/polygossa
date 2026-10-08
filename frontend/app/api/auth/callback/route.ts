import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { LOGIN_COOKIE, cognitoConfig, decodePending, exchangeCode, type Tokens } from "@/lib/cognito";
import { writeSession } from "@/lib/session";
import { BACKEND_URL } from "@/lib/server-api";

/** Starts the backend session for the tokens: null when it worked, else the error to show on the sign-in page. */
async function startSession(tokens: Tokens, acceptLanguage: string | null): Promise<string | null> {
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/cognito`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokens.access}` },
      body: JSON.stringify({ idToken: tokens.id, nativeLanguage: acceptLanguage?.split(",")[0] }),
      cache: "no-store",
    });
    if (res.ok) return null;
    return res.status === 403 ? "suspended" : "failed";
  } catch {
    return "unavailable";
  }
}

/** Where Cognito's hosted pages return after signing in: checks the return, starts the session, goes on. */
export async function GET(request: NextRequest) {
  const config = cognitoConfig();
  const params = request.nextUrl.searchParams;
  const pending = decodePending(request.cookies.get(LOGIN_COOKIE)?.value);
  const code = params.get("code");
  const done = (path: string) => {
    // On this site's public address: behind CloudFront and the load balancer, the request's own URL may say http.
    const response = NextResponse.redirect(new URL(path, config?.appUrl ?? request.url));
    response.cookies.delete(LOGIN_COOKIE);
    return response;
  };
  if (!config || !pending || !code || params.get("state") !== pending.state) return done("/login?error=failed");

  const tokens = await exchangeCode(config, code, pending.verifier);
  if (!tokens) return done("/login?error=failed");
  const error = await startSession(tokens, request.headers.get("accept-language"));
  if (error) return done(`/login?error=${error}`);

  const response = done(pending.next);
  writeSession(response.cookies, tokens);
  return response;
}
